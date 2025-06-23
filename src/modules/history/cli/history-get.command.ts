import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';

import { Algorithm } from '@app/common/enum/algorithm.enum';

@Command({ name: 'history:get', description: 'Get history data by sources' })
export class HistoryGetCommand extends CommandRunner {
  private readonly logger = new Logger(HistoryGetCommand.name);

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
  ) {
    super();
  }

  async run() {
    try {
      this.logger.log('Starting to get history data...');

      const dbSources = await this.sourceService.listAll();

      for (const source of dbSources) {
      }

      this.logger.log('Getting history data completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while getting history data:', error);
      return;
    }
  }
}
