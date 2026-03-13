import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';
import { PriceService } from 'modules/price/price.service';
import { HistoryCollectionRequest } from 'modules/history/types/history-collection-request.type';
import { IncomesRepository } from 'modules/history/repositories/incomes.repository';
import { SpendsRepository } from 'modules/history/repositories/spends.repository';
import { ReservesRepository } from 'modules/history/repositories/reserves.repository';

import { Algorithm } from 'common/enum/algorithm.enum';

@Injectable()
export class HistoryProcessingService {
  private readonly logger = new Logger(HistoryProcessingService.name);
  private isProcessing = false;

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
    private readonly priceService: PriceService,
    private readonly incomesRepository: IncomesRepository,
    private readonly spendsRepository: SpendsRepository,
    private readonly reservesRepository: ReservesRepository,
  ) {}

  public isProcessRunning(): boolean {
    return this.isProcessing;
  }

  private async executeWithLock<T>(
    processName: string,
    processFunction: () => Promise<T>,
  ): Promise<T | void> {
    if (this.isProcessRunning()) {
      this.logger.warn(`${processName} cannot start: another process is already running`);
      return;
    }

    this.isProcessing = true;
    this.logger.log(`Starting ${processName}...`);

    try {
      const result = await processFunction();
      this.logger.log(`Completed ${processName}`);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`An error occurred in ${processName}: ${error.message}`, error.stack);
        throw error;
      }

      this.logger.error(`An error occurred in ${processName}: ${String(error)}`);
      throw new Error(String(error));
    } finally {
      this.isProcessing = false;
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

  async startReservesProcessing(collectionSwitch?: HistoryCollectionRequest) {
    return this.executeWithLock('Reserves Processing', async () => {
      this.logger.log('Starting to process reserves...');

      const reservesAlgorithms = [
        Algorithm.COMET,
        Algorithm.MARKET_V2,
        Algorithm.ETH_WALLET,
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

      let startDate: Date | undefined;
      if (collectionSwitch?.clearData) {
        const sourceIds = dbSources.map((source) => source.id);
        this.logger.log(`Clearing reserves for ${sourceIds.length} sources...`);
        await this.reservesRepository.deleteBySourceIds(sourceIds);
        this.logger.log('Reserves cleared successfully.');
        startDate = collectionSwitch.data;
      }

      for (const source of dbSources) {
        const matchingAlgorithm = source.algorithm.find((algorithm) =>
          reservesAlgorithms.includes(algorithm as Algorithm),
        );

        if (matchingAlgorithm) {
          await this.contractService.saveReserves(source, matchingAlgorithm, startDate);
        }
      }

      this.logger.log('Reserves processing completed.');
    });
  }

  async startStatsProcessing(collectionSwitch?: HistoryCollectionRequest) {
    return this.executeWithLock('Stats Processing', async () => {
      this.logger.log('Starting to process stats...');
      let startDate: Date | undefined;
      if (collectionSwitch?.clearData) {
        this.logger.log('Clearing spends and incomes tables...');
        await Promise.all([this.spendsRepository.deleteAll(), this.incomesRepository.deleteAll()]);
        this.logger.log('Spends and incomes tables cleared successfully.');
        startDate = collectionSwitch.data;
      }

      const statsAlgorithms = [Algorithm.COMET_STATS];
      const dbSources = await this.sourceService.listByAlgorithms(statsAlgorithms);

      this.logger.log(`Found ${dbSources.length} sources for stats processing`);

      for (const source of dbSources) {
        const matchingAlgorithm = source.algorithm.find((algorithm) =>
          statsAlgorithms.includes(algorithm as Algorithm),
        );

        if (matchingAlgorithm) {
          await this.contractService.saveStats(source, matchingAlgorithm, startDate);
        }
      }

      this.logger.log('Stats processing completed.');
    });
  }

  async updatePriceCompForStats() {
    return this.executeWithLock('Price Comp Update', async () => {
      this.logger.log('Starting to update priceComp for stats...');

      const [incomesRecords, spendsRecords] = await Promise.all([
        this.incomesRepository.findAllWithMissingPriceComp(),
        this.spendsRepository.findAllWithMissingPriceComp(),
      ]);

      const assetCompToken = { address: null, symbol: 'COMP', decimals: null };

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
