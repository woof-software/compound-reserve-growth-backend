import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';

import { CollateralService } from 'modules/collateral/collateral.service';

@Command({ name: 'collateral:search-markets-v3', description: 'Search for collateral markets v3' })
export class CollateralSearchMarketsV3Command extends CommandRunner {
  private readonly logger = new Logger(CollateralSearchMarketsV3Command.name);

  constructor(private readonly collateralService: CollateralService) {
    super();
  }

  async run() {
    try {
      this.logger.log('Starting collateral search markets v3 process...');
      await this.collateralService.searchMarketsV3();
      this.logger.log('Collateral search markets v3 process completed.');
    } catch (error) {
      this.logger.error(
        'An error occurred while running collateral:search-markets-v3 command:',
        error,
      );
    }
  }
}
