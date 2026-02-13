import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { HistoryModule } from './history.module';
import { HistoryGetCron } from './cron/history-get.cron';

@Module({
  imports: [ScheduleModule.forRoot(), HistoryModule],
  providers: [HistoryGetCron],
})
export class HistoryCronModule {}
