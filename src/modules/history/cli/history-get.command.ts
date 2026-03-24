import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { HistoryProcessingService } from 'modules/history/services/history-processing.service';

@Command({ name: 'history:get', description: 'Get history data by sources' })
export class HistoryGetCommand extends CommandRunner {
  private readonly logger = new Logger(HistoryGetCommand.name);

  constructor(private readonly historyProcessingService: HistoryProcessingService) {
    super();
  }

  async run(): Promise<void> {
    try {
      await this.historyProcessingService.getHistory();
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`An error occurred while running history:get command: ${error.message}`);
        throw error;
      }

      this.logger.error(`An error occurred while running history:get command: ${String(error)}`);
      throw new Error(String(error));
    }
  }
}
