import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { GetHistoryService } from 'modules/history/cron/history-get.service';

import { TAppConfig } from '@app/config/app';

@Injectable()
export class HistoryGetCron implements OnModuleInit {
  private readonly logger = new Logger(HistoryGetCron.name);

  constructor(
    private readonly getHistoryService: GetHistoryService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const cronExpression = this.configService.get<TAppConfig>('app').cron;

    const jobHistory = new CronJob(
      cronExpression,
      async () => {
        await this.getHistoryTask();
      },
      null,
      false,
      'UTC',
    );

    const jobLiquidationsEvent = new CronJob(
      '22 13 * * *',
      async () => {
        await this.getLiquidationsEventTask();
      },
      null,
      false,
      'UTC',
    );

    this.schedulerRegistry.addCronJob('getHistory', jobHistory);
    this.schedulerRegistry.addCronJob('getLiquidationsEvent', jobLiquidationsEvent);

    jobHistory.start();
    jobLiquidationsEvent.start();
  }

  async getHistoryTask() {
    try {
      await this.getHistoryService.getHistory();
      return;
    } catch (error) {
      this.logger.error('An error occurred while running getting history task:', error);
      return;
    }
  }

  async getLiquidationsEventTask() {
    try {
      await this.getHistoryService.getLiquidationsEvent();
      return;
    } catch (error) {
      this.logger.error('An error occurred while running getting liquidations event task:', error);
      return;
    }
  }
}
