import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { GetHistoryService } from 'modules/history/cron/history-get.service';

import { TAppConfig } from 'config/app';

@Injectable()
export class HistoryGetCron implements OnApplicationBootstrap, OnApplicationShutdown {
  private static readonly JOB_NAME = 'getHistory';
  private readonly logger = new Logger(HistoryGetCron.name);

  constructor(
    private readonly getHistoryService: GetHistoryService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  private start(): void {
    if (this.schedulerRegistry.doesExist('cron', HistoryGetCron.JOB_NAME)) {
      this.logger.warn('History indexing cron is already registered');
      return;
    }

    const appConfig = this.configService.getOrThrow<TAppConfig>('app');
    const cronExpression = appConfig.cron;
    if (!cronExpression) {
      this.logger.error('History indexing cron expression is not configured');
      return;
    }

    const job = new CronJob(
      cronExpression,
      async () => {
        await this.getHistoryTask();
      },
      null,
      false,
      'UTC',
    );

    this.schedulerRegistry.addCronJob(HistoryGetCron.JOB_NAME, job);
    job.start();

    this.logger.log(
      `History indexing cron started with expression "${cronExpression}" in UTC timezone`,
    );
  }

  private async stop(): Promise<void> {
    if (!this.schedulerRegistry.doesExist('cron', HistoryGetCron.JOB_NAME)) {
      return;
    }

    const job = this.schedulerRegistry.getCronJob(HistoryGetCron.JOB_NAME);
    await job.stop();
    this.schedulerRegistry.deleteCronJob(HistoryGetCron.JOB_NAME);
    this.logger.log('History indexing cron stopped');
  }

  async getHistoryTask() {
    try {
      await this.getHistoryService.getHistory();
      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`An error occurred while running getting history task: ${message}`);
      return;
    }
  }
}
