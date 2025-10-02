import { Injectable, Logger } from '@nestjs/common';

import { GetHistoryService } from 'modules/history/cron/history-get.service';
import { StartCollectionResponse } from 'modules/admin/response';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly getHistoryService: GetHistoryService) {}

  async startReserves(collectionSwitch: StartCollectionResponse) {
    if (this.getHistoryService.isProcessRunning()) {
      this.logger.warn('Reserves processing was blocked - another process is running');
      return 'Blocked: Another process is already running';
    }

    // Start the process asynchronously without waiting
    this.getHistoryService.startReservesProcessing(collectionSwitch).catch((error) => {
      this.logger.error('Error in reserves processing:', error);
    });

    this.logger.log('Reserves processing started successfully');
    return 'Started successfully';
  }

  async startStats(collectionSwitch: StartCollectionResponse) {
    if (this.getHistoryService.isProcessRunning()) {
      this.logger.warn('Stats processing was blocked - another process is running');
      return 'Blocked: Another process is already running';
    }

    // Start the process asynchronously without waiting
    this.getHistoryService.startStatsProcessing(collectionSwitch).catch((error) => {
      this.logger.error('Error in stats processing:', error);
    });

    this.logger.log('Stats processing started successfully');
    return 'Started successfully';
  }
}
