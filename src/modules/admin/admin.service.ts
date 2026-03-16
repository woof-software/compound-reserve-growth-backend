import { Injectable, Logger } from '@nestjs/common';

import { StartCollectionResponse } from 'modules/admin/response';
import { HistoryCollectionQueueService } from 'modules/history/queue/history-collection-queue.service';
import { HistoryCollectionRequest } from 'modules/history/types/history-collection-request.type';

const toHistoryCollectionRequest = (
  request: StartCollectionResponse,
): HistoryCollectionRequest => ({
  clearData: request.clearData,
  data: request.data,
});

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly historyCollectionQueueService: HistoryCollectionQueueService) {}

  async startReserves(collectionSwitch: StartCollectionResponse) {
    const wasStarted = await this.historyCollectionQueueService.enqueueReservesCollection(
      toHistoryCollectionRequest(collectionSwitch),
    );
    if (!wasStarted) {
      this.logger.warn(
        'Reserves processing was blocked - the same job is already queued or running',
      );
      return 'Blocked: The same job is already queued or running';
    }

    this.logger.log('Reserves processing started successfully');
    return 'Started successfully';
  }

  async startStats(collectionSwitch: StartCollectionResponse) {
    const wasStarted = await this.historyCollectionQueueService.enqueueStatsCollection(
      toHistoryCollectionRequest(collectionSwitch),
    );
    if (!wasStarted) {
      this.logger.warn('Stats processing was blocked - the same job is already queued or running');
      return 'Blocked: The same job is already queued or running';
    }

    this.logger.log('Stats processing started successfully');
    return 'Started successfully';
  }
}
