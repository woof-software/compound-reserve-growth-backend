import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { DataUpdateService } from 'modules/data-update/data-update.service';

@Command({
  name: 'data:update',
  description: 'Update assets and sources from remote reserve data (creates new, updates existing)',
})
export class DataUpdateCommand extends CommandRunner {
  private readonly logger = new Logger(DataUpdateCommand.name);

  constructor(private readonly dataUpdateService: DataUpdateService) {
    super();
  }

  async run(): Promise<void> {
    try {
      await this.dataUpdateService.run();
    } catch (error) {
      this.logger.error(
        'Data update failed:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
