import { ChildProcess, fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TAppConfig } from 'config/app';

@Injectable()
export class HistoryIndexerChildProcessService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(HistoryIndexerChildProcessService.name);
  private indexerProcess: ChildProcess | null = null;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap(): void {
    const appConfig = this.configService.getOrThrow<TAppConfig>('app');
    if (!appConfig.indexerChildProcessEnabled) {
      this.logger.log('Indexer child process is disabled');
      return;
    }

    this.startIndexerProcess();
  }

  onApplicationShutdown(): void {
    this.isShuttingDown = true;
    if (!this.indexerProcess || this.indexerProcess.killed) {
      return;
    }

    this.logger.log(`Stopping indexer child process pid=${this.indexerProcess.pid}`);
    this.indexerProcess.kill('SIGTERM');
  }

  private startIndexerProcess(): void {
    const entrypoint = this.resolveEntrypoint();

    this.indexerProcess = fork(entrypoint, [], {
      stdio: 'inherit',
      env: {
        ...process.env,
        INDEXER_CHILD_PROCESS_ENABLED: 'false',
      },
    });

    this.logger.log(`Indexer child process started pid=${this.indexerProcess.pid}`);

    this.indexerProcess.on('error', (error) => {
      this.logger.error('Indexer child process failed', error.stack);
      this.terminateApplication('Indexer child process failed to start');
    });

    this.indexerProcess.on('exit', (code, signal) => {
      const pid = this.indexerProcess?.pid;
      this.indexerProcess = null;

      this.logger.warn(
        `Indexer child process exited pid=${pid} code=${code ?? 0} signal=${signal ?? 'none'}`,
      );

      if (!this.isShuttingDown) {
        this.terminateApplication('Indexer child process exited unexpectedly');
      }
    });
  }

  private resolveEntrypoint(): string {
    const entrypoint = join(__dirname, '..', '..', '..', 'indexer', 'indexer.main.js');
    if (existsSync(entrypoint)) {
      return entrypoint;
    }

    throw new Error(
      `Indexer entrypoint was not found at "${entrypoint}". Build the project before running this process`,
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
