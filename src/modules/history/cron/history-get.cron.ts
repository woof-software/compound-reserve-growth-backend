import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';

import { Algorithm } from '@app/common/enum/algorithm.enum';

@Injectable()
export class HistoryGetCron {
  private readonly logger = new Logger(HistoryGetCron.name);

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_NOON, { timeZone: 'UTC' })
  async getHistoryTask() {
    this.logger.log('⏰ Starting daily history sync…');
    try {
      this.logger.log('Starting to get history data...');

      const dbSources = await this.sourceService.listAll();

      for (const source of dbSources) {
        const { algorithm } = source;
        if (algorithm === Algorithm.COMET || algorithm === Algorithm.MARKET_V2) {
          await this.contractService.getMarketHistory(source);
        }
      }

      this.logger.log('Getting history data completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while getting history data:', error);
      return;
    }
  }
}
