import { Injectable, Logger } from '@nestjs/common';

import { GetHistoryService } from 'modules/history/cron/history-get.service';
import { StartReservesDto, StartStatsDto } from 'modules/admin/dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly getHistoryService: GetHistoryService) {}

  async startReserves(dto: StartReservesDto) {
    this.logger.log('Starting reserves processing');
    this.logger.log(`Enable flag: ${dto.enableFlag}`);
    if (dto.optionalParam) {
      this.logger.log(`Optional parameter: ${dto.optionalParam}`);
    }
    
    if (this.getHistoryService.isProcessRunning()) {
      this.logger.warn('Reserves processing was blocked - another process is running');
      return 'Blocked: Another process is already running';
    }

    // Start the process asynchronously without waiting
    this.getHistoryService.startReservesProcessing().catch((error) => {
      this.logger.error('Error in reserves processing:', error);
    });

    this.logger.log('Reserves processing started successfully');
    return 'Started successfully';
  }

  async startStats(dto: StartStatsDto) {
    this.logger.log('Starting stats processing');
    this.logger.log(`Enable flag: ${dto.enableFlag}`);
    if (dto.optionalParam) {
      this.logger.log(`Optional parameter: ${dto.optionalParam}`);
    }
    
    if (this.getHistoryService.isProcessRunning()) {
      this.logger.warn('Stats processing was blocked - another process is running');
      return 'Blocked: Another process is already running';
    }

    // Start the process asynchronously without waiting
    this.getHistoryService.startStatsProcessing().catch((error) => {
      this.logger.error('Error in stats processing:', error);
    });

    this.logger.log('Stats processing started successfully');
    return 'Started successfully';
  }
}
