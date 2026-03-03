import { Module } from '@nestjs/common';

import { HistoryModule } from './history.module';
import { HistoryGetCron } from './cron/history-get.cron';

@Module({
  imports: [HistoryModule],
  providers: [HistoryGetCron],
})
export class HistoryCronModule {}
