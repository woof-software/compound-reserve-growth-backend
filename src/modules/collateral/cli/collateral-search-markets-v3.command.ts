import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';

import { CollateralService } from 'modules/collateral/collateral.service';

@Command({ name: 'collateral:search-markets-v3', description: 'Search for collateral markets v3' })
export class CollateralSearchMarketsV3Command extends CommandRunner {
  private readonly logger = new Logger(CollateralSearchMarketsV3Command.name);
  private readonly outputFile = 'collateral-markets-v3.json';

  constructor(private readonly collateralService: CollateralService) {
    super();
  }

  async run(): Promise<void> {
    try {
      this.logger.log('Starting collateral search markets v3 process...');
      const output = await this.collateralService.searchMarketsV3();
      const outputPath = resolve(process.cwd(), this.outputFile);
      writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
      this.logger.log(`Collateral list saved to ${outputPath}`);
      this.logger.log('Collateral search markets v3 process completed.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `An error occurred while running collateral:search-markets-v3 command: ${message}`,
      );
      throw error instanceof Error ? error : new Error(message);
    }
  }
}
