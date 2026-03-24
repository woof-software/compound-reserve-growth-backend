import { Injectable, Logger } from '@nestjs/common';

import { StartCollectionRequest } from 'modules/admin/request';
import { HistoryCollectionQueueService } from 'modules/history/queue/history-collection-queue.service';
import { HistoryCollectionRequest } from 'modules/history/types/history-collection-request.type';

const toHistoryCollectionRequest = (request: StartCollectionRequest): HistoryCollectionRequest => ({
  clearData: request.clearData,
  data: request.data,
});

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly historyCollectionQueueService: HistoryCollectionQueueService) {}

  async startReserves(collectionSwitch: StartCollectionRequest) {
    const wasStarted = await this.historyCollectionQueueService.enqueueReservesCollection(
      toHistoryCollectionRequest(collectionSwitch),
    );
    if (!wasStarted) {
      this.logger.warn(
        'Reserves processing request was blocked - the same job is already queued or running',
      );
      return 'Blocked: The same job is already queued or running';
    }

    this.logger.log('Reserves processing job was queued successfully');
    return 'Queued successfully';
  }

  async startStats(collectionSwitch: StartCollectionRequest) {
    const wasStarted = await this.historyCollectionQueueService.enqueueStatsCollection(
      toHistoryCollectionRequest(collectionSwitch),
    );
    if (!wasStarted) {
      this.logger.warn(
        'Stats processing request was blocked - the same job is already queued or running',
      );
      return 'Blocked: The same job is already queued or running';
    }

    this.logger.log('Stats processing job was queued successfully');
    return 'Queued successfully';
  }
}
