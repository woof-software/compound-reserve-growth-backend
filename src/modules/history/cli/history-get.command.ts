import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { GetHistoryService } from 'modules/history/cron/history-get.service';

@Command({ name: 'history:get', description: 'Get history data by sources' })
export class HistoryGetCommand extends CommandRunner {
  private readonly logger = new Logger(HistoryGetCommand.name);

  constructor(private readonly getHistoryService: GetHistoryService) {
    super();
  }

  async run() {
    try {
      return this.getHistoryService.getHistory();
    } catch (error) {
      this.logger.error('An error occurred while running getHistory command:', error);
      return;
    }
  }
}
