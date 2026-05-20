import { Module } from '@nestjs/common';

import { HistoryModule } from './history.module';
import { HistoryGetCron } from './cron/history-get.cron';
import { HistoryCollectionWorkerService } from './queue/history-collection-worker.service';

@Module({
  imports: [HistoryModule],
  providers: [HistoryGetCron, HistoryCollectionWorkerService],
})
export class HistoryCronModule {}
