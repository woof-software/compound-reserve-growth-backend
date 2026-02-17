import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { SourcesUpdateService } from 'modules/sources-update/sources-update.service';

@Command({
  name: 'sources:update',
  description: 'Update assets and sources from remote reserve data (creates new, updates existing)',
})
export class SourcesUpdateCommand extends CommandRunner {
  private readonly logger = new Logger(SourcesUpdateCommand.name);

  constructor(private readonly sourcesUpdateService: SourcesUpdateService) {
    super();
  }

  async run(): Promise<void> {
    try {
      await this.sourcesUpdateService.run();
    } catch (error) {
      this.logger.error(
        'Sources update failed:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
