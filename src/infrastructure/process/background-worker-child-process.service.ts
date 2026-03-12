import { ChildProcess, fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TAppConfig } from 'config/app';

@Injectable()
export class BackgroundWorkerChildProcessService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BackgroundWorkerChildProcessService.name);
  private backgroundWorkerProcess: ChildProcess | null = null;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap(): void {
    const appConfig = this.configService.getOrThrow<TAppConfig>('app');
    if (!appConfig.indexerChildProcessEnabled) {
      this.logger.log('Background worker child process is disabled');
      return;
    }

    this.startBackgroundWorkerProcess();
  }

  onApplicationShutdown(): void {
    this.isShuttingDown = true;
    if (!this.backgroundWorkerProcess || this.backgroundWorkerProcess.killed) {
      return;
    }

    this.logger.log(
      `Stopping background worker child process pid=${this.backgroundWorkerProcess.pid}`,
    );
    this.backgroundWorkerProcess.kill('SIGTERM');
  }

  private startBackgroundWorkerProcess(): void {
    const entrypoint = this.resolveEntrypoint();

    this.backgroundWorkerProcess = fork(entrypoint, [], {
      stdio: 'inherit',
      env: {
        ...process.env,
        INDEXER_CHILD_PROCESS_ENABLED: 'false',
      },
    });

    this.logger.log(
      `Background worker child process started pid=${this.backgroundWorkerProcess.pid}`,
    );

    this.backgroundWorkerProcess.on('error', (error) => {
      this.logger.error('Background worker child process failed', error.stack);
      this.terminateApplication('Background worker child process failed to start');
    });

    this.backgroundWorkerProcess.on('exit', (code, signal) => {
      const pid = this.backgroundWorkerProcess?.pid;
      this.backgroundWorkerProcess = null;

      this.logger.warn(
        `Background worker child process exited pid=${pid} code=${code ?? 0} signal=${signal ?? 'none'}`,
      );

      if (!this.isShuttingDown) {
        this.terminateApplication('Background worker child process exited unexpectedly');
      }
    });
  }

  private resolveEntrypoint(): string {
    const entrypoint = join(__dirname, '..', '..', 'indexer', 'indexer.main.js');
    if (existsSync(entrypoint)) {
      return entrypoint;
    }

    throw new Error(
      `Background worker entrypoint was not found at "${entrypoint}". Build the project before running this process`,
    );
  }

  private terminateApplication(reason: string): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    process.exitCode = 1;
    this.logger.error(reason);
    process.kill(process.pid, 'SIGTERM');
  }
}
