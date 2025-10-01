import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';
import { StartCollectionResponse } from 'modules/admin/response';
import { IncomesRepository } from 'modules/history/incomes-repository.service';
import { SpendsRepository } from 'modules/history/spends-repository.service';
import { ReservesRepository } from 'modules/history/reserves-repository.service';
import { Source } from 'modules/source/source.entity';

import { Algorithm } from 'common/enum/algorithm.enum';

@Injectable()
export class GetHistoryService {
  private readonly logger = new Logger(GetHistoryService.name);
  private isProcessing = false;

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
    private readonly incomesRepository: IncomesRepository,
    private readonly spendsRepository: SpendsRepository,
    private readonly reservesRepository: ReservesRepository,
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

  /**
   * Updates blockNumber for sources with reserves algorithms
   * @param sources - Array of sources to update
   * @param startDate - Optional date to start from. If not provided, uses contract creation block
   */
  private async updateSourcesBlockNumber(sources: Source[], startDate: Date): Promise<void> {
    this.logger.log(`Updating blockNumber for ${sources.length} sources...`);

    const updatePromises = sources.map(async (source) => {
      try {
        const newBlockNumber = await this.contractService.getSourceBlockNumber(source, startDate);

        await this.sourceService.updateWithSource({
          source,
          blockNumber: newBlockNumber,
          checkedAt: new Date(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to update blockNumber for source ${source.id} (${source.address}): ${error.message}`,
        );
        throw error; // Re-throw to stop the entire process if any source fails
      }
    });

    await Promise.all(updatePromises);
    this.logger.log(`Successfully updated blockNumber for ${sources.length} sources`);
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

  async startReservesProcessing(dto?: StartCollectionResponse) {
    return this.executeWithLock('Reserves Processing', async () => {
      this.logger.log('Starting to process reserves...');

      const reservesAlgorithms = [Algorithm.COMET, Algorithm.MARKET_V2];
      const dbSources = await this.sourceService.listByAlgorithms(reservesAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for reserves processing`);

      if (dto?.enableFlag) {
        this.logger.log('Clearing reserves table...');
        await this.reservesRepository.deleteAll();
        this.logger.log('Reserves table cleared successfully.');
        await this.updateSourcesBlockNumber(dbSources, dto.data);
      }

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

  async startStatsProcessing(dto?: StartCollectionResponse) {
    return this.executeWithLock('Stats Processing', async () => {
      this.logger.log('Starting to process stats...');
      let data: Date;
      if (dto?.enableFlag) {
        this.logger.log('Clearing spends and incomes tables...');
        await Promise.all([this.spendsRepository.deleteAll(), this.incomesRepository.deleteAll()]);
        this.logger.log('Spends and incomes tables cleared successfully.');
        data = dto.data;
      }

      const statsAlgorithms = [Algorithm.COMET_STATS, Algorithm.MARKET_V2_STATS];
      const dbSources = await this.sourceService.listByAlgorithms(statsAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for stats processing`);

      for (const source of dbSources) {
        const matchingAlgorithm = source.algorithm.find((alg) =>
          statsAlgorithms.includes(alg as Algorithm),
        );

        if (matchingAlgorithm) {
          await this.contractService.saveStats(source, matchingAlgorithm, data);
        }
      }

      this.logger.log('Stats processing completed.');
    });
  }
}
