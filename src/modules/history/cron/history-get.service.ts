import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';

import { Algorithm } from 'common/enum/algorithm.enum';

@Injectable()
export class GetHistoryService {
  private readonly logger = new Logger(GetHistoryService.name);
  private isProcessing = false;

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
  ) {}

  /**
   * Checks if any process is currently running
   */
  public isProcessRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Starts a process with automatic lock management
   */
  private async executeWithLock<T>(
    processName: string,
    processFunction: () => Promise<T>,
  ): Promise<T | void> {
    if (this.isProcessRunning()) {
      this.logger.warn(`❌ ${processName} cannot start: another process is already running`);
      return;
    }

    this.isProcessing = true;
    this.logger.log(`🔒 Starting ${processName}...`);

    try {
      return await processFunction();
    } catch (error) {
      this.logger.error(`An error occurred in ${processName}:`, error);
    } finally {
      this.isProcessing = false;
      this.logger.log(`🔓 Completed ${processName}`);
    }
  }

  async getHistory() {
    return this.executeWithLock('Daily History Sync', async () => {
      this.logger.log('Starting to get history data...');

      const dbSources = await this.sourceService.listAll();

      for (const source of dbSources) {
        await this.contractService.getHistory(source);
      }

      this.logger.log('Getting history data completed.');
    });
  }

  async startReservesProcessing() {
    return this.executeWithLock('Reserves Processing', async () => {
      this.logger.log('Starting to process reserves...');

      const reservesAlgorithms = [Algorithm.COMET, Algorithm.MARKET_V2];
      const dbSources = await this.sourceService.listByAlgorithms(reservesAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for reserves processing`);

      for (const source of dbSources) {
        const matchingAlgorithm = source.algorithm.find((alg) =>
          reservesAlgorithms.includes(alg as Algorithm),
        );

        if (matchingAlgorithm) {
          await this.contractService.saveReserves(source, matchingAlgorithm);
        }
      }

      this.logger.log('Reserves processing completed.');
    });
  }

  async startStatsProcessing() {
    return this.executeWithLock('Stats Processing', async () => {
      this.logger.log('Starting to process stats...');

      const statsAlgorithms = [Algorithm.COMET_STATS, Algorithm.MARKET_V2_STATS];
      const dbSources = await this.sourceService.listByAlgorithms(statsAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for stats processing`);

      for (const source of dbSources) {
        const matchingAlgorithm = source.algorithm.find((alg) =>
          statsAlgorithms.includes(alg as Algorithm),
        );

        if (matchingAlgorithm) {
          await this.contractService.saveStats(source, matchingAlgorithm);
        }
      }

      this.logger.log('Stats processing completed.');
    });
  }
}
