import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';

import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class GetHistoryService {
  private readonly logger = new Logger(GetHistoryService.name);

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
  ) {}

  async getHistory() {
    this.logger.log('⏰ Starting daily history sync…');
    try {
      this.logger.log('Starting to get history data...');

      const dbSources = await this.sourceService.listAll();

      for (const source of dbSources) {
        await this.contractService.getHistory(source);
      }

      this.logger.log('Getting history data completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while getting history data:', error);
      return;
    }
  }

  async getLiquidationsEvent() {
    this.logger.log('⏰ Starting daily liquidations event sync…');
    try {
      this.logger.log('Starting to get liquidations event data...');

      const dbSourcesComet = await this.sourceService.listByAlgorithm(Algorithm.COMET);

      for (const source of dbSourcesComet) {
        await this.contractService.getLiquidationsEvent(source);
      }

      this.logger.log('Getting liquidations event data completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while getting liquidations event data:', error);
      return;
    }
  }
}
