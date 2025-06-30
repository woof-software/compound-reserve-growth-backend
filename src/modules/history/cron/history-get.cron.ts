import { Injectable, Logger } from '@nestjs/common';

import { GetHistoryService } from 'modules/history/cron/history-get.service';

@Injectable()
export class HistoryGetCron {
  private readonly logger = new Logger(HistoryGetCron.name);

  constructor(private readonly getHistoryService: GetHistoryService) {}

  async getHistoryTask() {
    try {
      await this.getHistoryService.getHistory();
      return;
    } catch (error) {
      this.logger.error('An error occurred while running getting history task:', error);
      return;
    }
  }
}
