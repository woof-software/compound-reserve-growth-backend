import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { HistoryProcessingService } from 'modules/history/services/history-processing.service';

@Command({ name: 'stats:get', description: 'Get stats data by sources' })
export class StatsGetCommand extends CommandRunner {
  private readonly logger = new Logger(StatsGetCommand.name);

  constructor(private readonly historyProcessingService: HistoryProcessingService) {
    super();
  }

  async run(): Promise<void> {
    try {
      this.logger.log('Starting stats priceComp update process...');
      await this.historyProcessingService.updatePriceCompForStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`An error occurred while running stats:get command: ${error.message}`);
        throw error;
      }

      this.logger.error(`An error occurred while running stats:get command: ${String(error)}`);
      throw new Error(String(error));
    }
  }
}
