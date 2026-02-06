import { Module } from '@nestjs/common';

import { HistoryModule } from 'modules/history/history.module';

import { HistoryGetCron } from './history-get.cron';

@Module({
  imports: [HistoryModule],
  providers: [HistoryGetCron],
})
export class HistoryCronModule {}
