import { Module } from '@nestjs/common';

import { HistoryIndexerChildProcessService } from './process/history-indexer-child-process.service';

@Module({
  providers: [HistoryIndexerChildProcessService],
})
export class HistoryIndexerModule {}
