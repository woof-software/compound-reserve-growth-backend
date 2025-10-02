import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { GetHistoryService } from 'modules/history/cron/history-get.service';

@Command({ name: 'stats:get', description: 'Get stats data by sources' })
export class StatsGetCommand extends CommandRunner {
  private readonly logger = new Logger(StatsGetCommand.name);

  constructor(private readonly getHistoryService: GetHistoryService) {
    super();
  }

  async run() {
    try {
      this.logger.log('Starting stats priceComp update process...');
      return await this.getHistoryService.updatePriceCompForIncentives();
    } catch (error) {
      this.logger.error('An error occurred while running stats:get command:', error);
      return;
    }
  }
}
