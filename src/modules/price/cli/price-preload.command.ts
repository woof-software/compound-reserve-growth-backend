import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { PriceService } from 'modules/price/price.service';

@Command({ name: 'price:preload', description: 'Preload price data' })
export class PricePreloadCommand extends CommandRunner {
  private readonly logger = new Logger(PricePreloadCommand.name);

  constructor(private readonly priceService: PriceService) {
    super();
  }

  async run() {
    try {
      await this.priceService.forceReloadAllHistoricalData();
      this.logger.log('Price data preloaded successfully');
    } catch (error) {
      this.logger.error('An error occurred while running price preload command:', error);
      return;
    }
  }
}
