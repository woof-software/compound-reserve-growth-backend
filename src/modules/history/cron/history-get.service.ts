import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';
import { PriceService } from 'modules/price/price.service';
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
    private readonly priceService: PriceService,
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

  async startReservesProcessing(collectionSwitch?: StartCollectionResponse) {
    return this.executeWithLock('Reserves Processing', async () => {
      this.logger.log('Starting to process reserves...');

      const reservesAlgorithms = [
        Algorithm.COMET,
        Algorithm.MARKET_V2,
        Algorithm.AERA_COMPOUND_RESERVES,
        Algorithm.AERA_VENDORS_VAULT,
        Algorithm.AVANTGARDE_TREASURY_GROWTH_PROPOSAL,
        Algorithm.COMPOUND_COMMUNITY_MULTISIG,
        Algorithm.COMPTROLLER,
        Algorithm.DELEGATE_RACE,
        Algorithm.IMMUNEFI_BUG_BOUNTY_PROGRAM,
        Algorithm.MANTLE,
        Algorithm.OPENZEPPELIN_PAYMENT_STREAM_CONTRACT,
        Algorithm.REWARDS,
        Algorithm.TIMELOCK,
        Algorithm.WOOF_PAYMENT_STREAM_CONTRACT,
      ];
      const dbSources = await this.sourceService.listByAlgorithms(reservesAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for reserves processing`);

      if (collectionSwitch?.clearData) {
        this.logger.log('Clearing reserves table...');
        await this.reservesRepository.deleteAll();
        this.logger.log('Reserves table cleared successfully.');
        await this.updateSourcesBlockNumber(dbSources, collectionSwitch.data);
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

  async startStatsProcessing(collectionSwitch?: StartCollectionResponse) {
    return this.executeWithLock('Stats Processing', async () => {
      this.logger.log('Starting to process stats...');
      let data: Date;
      if (collectionSwitch?.clearData) {
        this.logger.log('Clearing spends and incomes tables...');
        await Promise.all([this.spendsRepository.deleteAll(), this.incomesRepository.deleteAll()]);
        this.logger.log('Spends and incomes tables cleared successfully.');
        data = collectionSwitch.data;
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

  async updatePriceCompForStats() {
    return this.executeWithLock('Price Comp Update', async () => {
      this.logger.log('Starting to update priceComp for stats...');

      // Get all incomes and spends records with missing priceComp (priceComp = 0)
      const [incomesRecords, spendsRecords] = await Promise.all([
        this.incomesRepository.findAllWithMissingPriceComp(),
        this.spendsRepository.findAllWithMissingPriceComp(),
      ]);

      const assetCompToken = { address: null, symbol: 'COMP', decimals: null };

      // Update incomes records
      let updatedIncomes = 0;
      let failedIncomes = 0;

      for (const income of incomesRecords) {
        try {
          const priceComp = await this.priceService.getHistoricalPrice(assetCompToken, income.date);
          if (priceComp > 0) {
            await this.incomesRepository.updatePriceComp(income.id, priceComp);
            updatedIncomes++;
            this.logger.debug(`Updated priceComp for income ID ${income.id}: ${priceComp} USD`);
          } else {
            this.logger.warn(
              `Invalid COMP price (${priceComp}) for income ID ${income.id} on ${income.date.toISOString().slice(0, 10)}`,
            );
            failedIncomes++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to update priceComp for income ID ${income.id}: ${error.message}`,
          );
          failedIncomes++;
        }
      }

      // Update spends records
      let updatedSpends = 0;
      let failedSpends = 0;

      for (const spend of spendsRecords) {
        try {
          const priceComp = await this.priceService.getHistoricalPrice(assetCompToken, spend.date);
          if (priceComp > 0) {
            await this.spendsRepository.updatePriceComp(spend.id, priceComp);
            updatedSpends++;
            this.logger.debug(`Updated priceComp for spend ID ${spend.id}: ${priceComp} USD`);
          } else {
            this.logger.warn(
              `Invalid COMP price (${priceComp}) for spend ID ${spend.id} on ${spend.date.toISOString().slice(0, 10)}`,
            );
            failedSpends++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to update priceComp for spend ID ${spend.id}: ${error.message}`,
          );
          failedSpends++;
        }
      }

      this.logger.log(
        `Price Comp update completed: ${updatedIncomes} incomes and ${updatedSpends} spends updated successfully`,
      );
      this.logger.log(`Failed updates: ${failedIncomes} incomes and ${failedSpends} spends`);
    });
  }
}
