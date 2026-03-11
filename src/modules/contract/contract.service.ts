import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { MulticallProvider } from 'ethers-multicall-provider';

import { IncomesEntity, ReserveEntity, SpendsEntity } from 'modules/history/entities';
import { HistoryService } from 'modules/history/history.service';
import { SourceEntity } from 'modules/source/source.entity';
import { PriceService } from 'modules/price/price.service';
import { MailService } from 'modules/mail/mail.service';
import { STABLECOIN_PRICES } from 'modules/price/constants';
import { AlgorithmService } from 'modules/contract/algorithm.service';

import { ProviderFactory } from 'common/chains/network/provider.factory';
import { BlockService } from 'common/chains/block/block.service';

import CometABI from './abi/CometABI.json';
import CometExtensionABI from './abi/CometExtensionABI.json';
import ComptrollerABI from './abi/ComptrollerABI.json';
import MarketV2ABI from './abi/MarketV2ABI.json';
import RewardsABI from './abi/RewardsABI.json';
import LegacyRewardsABI from './abi/LegacyRewardsABI.json';
import ERC20ABI from './abi/ERC20ABI.json';
import Bytes32TokenABI from './abi/Bytes32TokenABI.json';
import { MarketData, RootJson } from './contract.type';
import { ResponseStatsAlgorithm } from './interface';

import { SEC_IN_MS } from '@app/common/constants';
import { Algorithm } from '@app/common/enum/algorithm.enum';
import { calculateTimeRange } from '@/common/utils/calculate-time-range';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly blockService: BlockService,
    private readonly historyService: HistoryService,
    private readonly priceService: PriceService,
    private readonly algorithmService: AlgorithmService,
    private readonly mailService: MailService,
  ) {}

  async readMarketData(root: RootJson, networkPath: string): Promise<MarketData> {
    const [networkKey] = networkPath.split('/');
    if (!networkKey) {
      this.logger.error(
        `Invalid networkPath format networkPath: ${root.networkPath} expectedFormat: network/market`,
      );
      throw new Error(`Invalid networkPath format: '${root.networkPath}'`);
    }

    let provider: MulticallProvider<ethers.JsonRpcProvider>;
    try {
      provider = this.providerFactory.multicall(networkKey);
    } catch (e) {
      this.logger.error(
        `Unsupported network in path network: ${networkKey} path: ${root.networkPath}`,
      );
      throw e;
    }

    const blockTag = await this.blockService.getSafeBlockNumber(networkKey);

    const cometAddress = root.comet;
    const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

    const extensionDelegateAddress = await cometContract.extensionDelegate({ blockTag });
    const extensionDelegateContract = new ethers.Contract(
      extensionDelegateAddress,
      CometExtensionABI,
      provider,
    ) as any;

    const cometSymbol = await extensionDelegateContract.symbol({ blockTag });

    const rewardsAddress = root.rewards || '';

    return {
      network: networkKey,
      market: cometSymbol,
      cometAddress,
      rewardsAddress,
      provider,
    };
  }

  async getContractCreationBlock(contractAddress: string, network: string): Promise<number> {
    try {
      const provider = this.providerFactory.get(network);
      const currentBlock = await provider.getBlockNumber();
      let left = 0;
      let right = currentBlock;

      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const code = await provider.getCode(contractAddress, mid);

        if (code === '0x') {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      this.logger.log(`Contract ${contractAddress} was created at block ${left}`);
      return left;
    } catch (error) {
      this.logger.error(`Error finding creation block for ${contractAddress}:`, error);
      throw error;
    }
  }

  async getAllComptrollerMarkets(comptrollerAddress: string, network: string): Promise<string[]> {
    try {
      const provider = this.providerFactory.get(network);
      const blockTag = await this.blockService.getSafeBlockNumber(network);

      const comptrollerContract = new ethers.Contract(
        comptrollerAddress,
        ComptrollerABI,
        provider,
      ) as any;

      const allMarkets = await comptrollerContract.getAllMarkets({ blockTag });

      return allMarkets;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error finding comptroller markets comptroller: ${comptrollerAddress} network: ${network} error: ${message}`,
      );
      throw error;
    }
  }

  async getMarketSymbol(marketAddress: string, network: string): Promise<string> {
    try {
      const provider = this.providerFactory.get(network);
      const blockTag = await this.blockService.getSafeBlockNumber(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const symbol = await marketContract.symbol({ blockTag });

      return symbol;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error finding market symbol market: ${marketAddress} network: ${network} error: ${message}`,
      );
      throw error;
    }
  }

  async getCometBaseToken(cometAddress: string, network: string) {
    try {
      const provider = this.providerFactory.multicall(network);
      const blockTag = await this.blockService.getSafeBlockNumber(network);

      const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

      const tokenAddress = await cometContract.baseToken({ blockTag });

      const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider) as any;

      const symbol = await tokenContract.symbol({ blockTag });
      const decimals = await tokenContract.decimals({ blockTag });

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error getting comet base token comet: ${cometAddress} network: ${network} error: ${message}`,
      );
      throw error;
    }
  }

  async getMarketV2UnderlyingToken(marketAddress: string, network: string) {
    try {
      if (marketAddress === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5') {
        // NATIVE ETH
        return {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18,
        };
      }

      const provider = this.providerFactory.multicall(network);
      const blockTag = await this.blockService.getSafeBlockNumber(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const tokenAddress = await marketContract.underlying({ blockTag });

      const bytes32Tokens = [
        '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      ];

      const tokenABI = bytes32Tokens.includes(tokenAddress) ? Bytes32TokenABI : ERC20ABI;

      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider) as any;

      const rawSymbol = await tokenContract.symbol({ blockTag });

      const symbol = bytes32Tokens.includes(tokenAddress)
        ? ethers.toUtf8String(rawSymbol).replace(/\u0000/g, '')
        : rawSymbol;

      const decimals = await tokenContract.decimals({ blockTag });

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error getting market v2 underlying token market: ${marketAddress} network: ${network} error: ${message}`,
      );
      throw error;
    }
  }

  async getRewardsCompToken(
    rewardsAddress: string,
    cometAddress: string,
    network: string,
    provider: MulticallProvider<ethers.JsonRpcProvider>,
    blockTag: number,
  ): Promise<string> {
    const legacyNetworks = ['mainnet', 'polygon'];
    const rewardsABI = legacyNetworks.includes(network) ? LegacyRewardsABI : RewardsABI;
    const rewardsContract = new ethers.Contract(rewardsAddress, rewardsABI, provider) as any;

    const rewardConfig = await rewardsContract.rewardConfig(cometAddress, { blockTag });
    const tokenAddress = rewardConfig[0];
    return tokenAddress;
  }

  async getHistory(source: SourceEntity) {
    const { algorithm } = source;

    for (const alg of algorithm) {
      switch (alg) {
        case Algorithm.COMET:
          await this.saveReserves(source, alg);
          break;
        case Algorithm.MARKET_V2:
          await this.saveReserves(source, alg);
          break;
        case Algorithm.ETH_WALLET:
          await this.saveReserves(source, alg);
          break;
        case Algorithm.COMET_STATS:
          await this.saveStats(source, alg);
          break;
        default:
          await this.saveReserves(source, alg);
      }
    }
  }

  public async saveReserves(
    source: SourceEntity,
    algorithm: string,
    startDate?: Date,
  ): Promise<void> {
    const { address: contractAddress, network, asset } = source;
    const { address: assetAddress } = asset;

    this.logger.log(
      `Starting history collection for source ${source.id} on ${network}, algorithm: ${algorithm}`,
    );

    try {
      const provider = this.providerFactory.multicall(network);

      let lastBlock: number;

      if (startDate) {
        try {
          const startBlockData = await this.blockService.getCachedBlock(
            network,
            provider,
            source.startBlock,
          );
          const startBlockTimestamp = startBlockData.timestamp;
          const providedTimestamp = Math.floor(startDate.getTime() / 1000);

          const targetTimestamp = Math.max(startBlockTimestamp, providedTimestamp);

          if (providedTimestamp < startBlockTimestamp) {
            this.logger.log(
              `Provided date ${startDate.toISOString()} is older than source.startBlock. Using startBlock ${source.startBlock} for ${source.address} on ${source.network}`,
            );
            lastBlock = source.startBlock;
          } else {
            lastBlock = await this.blockService.findBlockByTimestamp(
              network,
              provider,
              targetTimestamp,
            );
            if (source.endBlock != null && lastBlock > source.endBlock) {
              lastBlock = source.endBlock;
              this.logger.log(
                `Capped to source.endBlock=${lastBlock} for ${source.address} on ${source.network}`,
              );
            }
            this.logger.log(
              `Using provided date ${startDate.toISOString()} to start from block ${lastBlock} for ${source.address} on ${source.network}`,
            );
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          this.logger.error(
            `Failed to find block for date ${startDate.toISOString()} for ${source.address} on ${source.network}: ${message}`,
          );
          return;
        }
      } else {
        const latestReserve = await this.historyService.findLatestReserveBySource(source);
        lastBlock = latestReserve?.blockNumber ?? source.startBlock;
        if (source.endBlock != null && lastBlock >= source.endBlock) {
          this.logger.log(
            `No historical data needed - source ${source.id} already reached endBlock ${source.endBlock}`,
          );
          return;
        }
      }

      const startBlockData = await this.blockService.getCachedBlock(network, provider, lastBlock);
      const startTs = startBlockData.timestamp;

      const { firstMidnightUTC, todayMidnightUTC, dailyTs } = calculateTimeRange(startTs);

      // Check if we have any days to process
      if (firstMidnightUTC > todayMidnightUTC) {
        this.logger.log(`No historical data needed - source is already up to date`);
        return;
      }

      this.logger.log(
        `Processing ${dailyTs.length} daily timestamps from ${new Date(firstMidnightUTC * 1000).toISOString().slice(0, 10)} to ${new Date(todayMidnightUTC * 1000).toISOString().slice(0, 10)}`,
      );

      // Check if we have a reasonable number of days to process
      if (dailyTs.length === 0) {
        this.logger.warn(`No days to process for source ${source.id}`);
        return;
      }

      // Prices preload
      if (!STABLECOIN_PRICES[asset.symbol]) {
        try {
          const firstDate = new Date(firstMidnightUTC * 1000);
          await this.priceService.getHistoricalPrice(
            { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
            firstDate,
          );
          this.logger.log(`Price data preloaded for ${asset.symbol}`);
        } catch (error) {
          this.logger.warn(`Failed to preload price data for ${asset.symbol}: ${error.message}`);
        }
      } else {
        this.logger.log(`Skipping preload for stablecoin ${asset.symbol}`);
      }

      let processedCount = 0;
      let skippedCount = 0;

      const ABI = algorithm === Algorithm.COMET ? CometABI : MarketV2ABI;

      const contract = new ethers.Contract(contractAddress, ABI, provider) as any;
      const assetContract = new ethers.Contract(assetAddress, ERC20ABI, provider) as any;

      for (const targetTs of dailyTs) {
        try {
          let blockTag = await this.blockService.findBlockByTimestamp(
            network,
            provider,
            targetTs,
            lastBlock,
          );
          if (source.endBlock != null && blockTag > source.endBlock) {
            blockTag = source.endBlock;
          }

          let reserves: bigint;
          try {
            switch (algorithm) {
              case Algorithm.COMET:
                reserves = await this.algorithmService.comet(contract, blockTag);
                break;
              case Algorithm.MARKET_V2:
                reserves = await this.algorithmService.marketV2(contract, blockTag);
                break;
              case Algorithm.ETH_WALLET:
                reserves = await provider.getBalance(contractAddress, blockTag);
                break;
              default:
                if (asset.symbol === 'ETH' || asset.symbol === 'MNT') {
                  reserves = await provider.getBalance(contractAddress, blockTag);
                } else {
                  reserves = await assetContract.balanceOf(contractAddress, { blockTag });
                }
                break;
            }
          } catch (e: any) {
            if (e.code === 'CALL_EXCEPTION') {
              const message = `Skip ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)} block number ${blockTag} - reserves unavailable for contract ${contractAddress} at network ${network}, algorithm ${algorithm}, asset ${asset.symbol}`;
              this.logger.warn(message);
              lastBlock = blockTag;
              skippedCount++;
              await this.mailService.notifyGetHistoryError(message);
              if (source.endBlock != null && blockTag >= source.endBlock) {
                this.logger.log(
                  `Reached endBlock ${source.endBlock} for source ${source.id}. Stopping processing.`,
                );
                break;
              }
              continue;
            } else {
              throw e;
            }
          }

          const { symbol, decimals } = asset;
          const date = new Date(targetTs * 1000);

          // Get price using PriceService
          let price = 1;
          try {
            price = await this.priceService.getHistoricalPrice(
              { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
              date,
            );

            if (price <= 0) {
              throw new Error(`Invalid price received: ${price}`);
            }
          } catch (priceError) {
            const message = `Price fetch failed for ${symbol} on ${date.toISOString().slice(0, 10)}: ${priceError.message}. Stopping to retry on next cron run.`;
            this.logger.error(message);
            await this.mailService.notifyGetHistoryError(message);

            // Stop processing - will retry from this date on next cron run
            return;
          }

          const quantity = ethers.formatUnits(reserves, decimals);
          const value = Number(quantity) * price;

          if (isNaN(value)) {
            this.logger.warn(`Invalid value: ${value}, skipping`);
            lastBlock = blockTag;
            skippedCount++;
            if (source.endBlock != null && blockTag >= source.endBlock) {
              this.logger.log(
                `Reached endBlock ${source.endBlock} for source ${source.id}. Stopping processing.`,
              );
              break;
            }
            continue;
          }
          if (value < 0)
            this.logger.warn(
              `Reserves have a negative value: ${value}, contractAddress: ${contractAddress}, network: ${network}`,
            );

          const newHistory = new ReserveEntity(
            source,
            blockTag,
            reserves.toString(),
            price,
            value,
            date,
          );

          await this.historyService.createReservesWithSource(newHistory);

          lastBlock = blockTag;
          processedCount++;
          if (source.endBlock != null && blockTag >= source.endBlock) {
            this.logger.log(
              `Reached endBlock ${source.endBlock} for source ${source.id}. Stopping processing.`,
            );
            break;
          }

          if (processedCount % 50 === 0) {
            this.logger.log(
              `Progress: ${processedCount}/${dailyTs.length} days processed (${skippedCount} skipped)`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to process timestamp ${targetTs}: ${error.message}`);

          const blocksPerDay = this.blockService.getBlocksPerDay(network, lastBlock);
          lastBlock = lastBlock + blocksPerDay;
          skippedCount++;
          if (source.endBlock != null && lastBlock >= source.endBlock) {
            this.logger.log(
              `Reached endBlock ${source.endBlock} for source ${source.id}. Stopping processing.`,
            );
            break;
          }
          continue;
        }
      }

      // Calculate final statistics
      const totalAttempted = dailyTs.length;
      const successRate =
        totalAttempted > 0 ? Math.round((processedCount / totalAttempted) * 100) : 0;

      this.logger.log(
        `Completed: ${successRate}% success (${processedCount}/${totalAttempted} processed, ${skippedCount} skipped)`,
      );
    } catch (error) {
      const message = `Error processing source ${source.id} on ${network} for contract ${contractAddress}, algorithm ${algorithm}, asset ${asset.symbol}: ${error.message}`;
      this.logger.error(message);
      await this.mailService.notifyGetHistoryError(message);
    }
  }

  public async saveStats(source: SourceEntity, algorithm: string, startDate?: Date): Promise<void> {
    const { address: contractAddress, network, asset } = source;

    this.logger.log(
      `Starting history collection for source ${source.id} on ${network}, algorithm: ${algorithm}`,
    );

    try {
      const provider = this.providerFactory.multicall(network);

      let lastBlock: number | undefined;

      if (startDate) {
        try {
          const startBlockData = await this.blockService.getCachedBlock(
            network,
            provider,
            source.startBlock,
          );
          const startBlockTimestamp = startBlockData.timestamp;
          const providedTimestamp = Math.floor(startDate.getTime() / 1000);

          const targetTimestamp = Math.max(startBlockTimestamp, providedTimestamp);

          if (providedTimestamp < startBlockTimestamp) {
            this.logger.log(
              `Provided date ${startDate.toISOString()} is older than source.startBlock. Using startBlock ${source.startBlock} for ${source.address} on ${source.network}`,
            );
            lastBlock = source.startBlock;
          } else {
            lastBlock = await this.blockService.findBlockByTimestamp(
              network,
              provider,
              targetTimestamp,
            );
            this.logger.log(
              `Using provided date ${startDate.toISOString()} to start from block ${lastBlock} for ${source.address} on ${source.network}`,
            );
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          this.logger.error(
            `Failed to find block for date ${startDate.toISOString()} for ${source.address} on ${source.network}: ${message}`,
          );
          return;
        }
      } else {
        const spends = await this.historyService.findSpendsBySource(source);
        const incomes = await this.historyService.findIncomesBySource(source);

        if (incomes?.blockNumber) {
          lastBlock = incomes.blockNumber;
        }
        if (spends?.blockNumber && (!lastBlock || spends.blockNumber < lastBlock)) {
          lastBlock = spends.blockNumber;
        }
        if (!lastBlock) {
          lastBlock = source.startBlock;
          this.logger.log(
            `No previous stats events. Starting scan from source.startBlock=${lastBlock} for ${source.address} on ${source.network}`,
          );
        }
      }

      const startBlockData = await this.blockService.getCachedBlock(network, provider, lastBlock);
      const startTs = startBlockData.timestamp;

      const { firstMidnightUTC, todayMidnightUTC, dailyTs } = calculateTimeRange(startTs);

      // Check if we have any days to process
      if (firstMidnightUTC > todayMidnightUTC) {
        this.logger.log(`No historical data needed - source is already up to date`);
        return;
      }

      this.logger.log(
        `Processing ${dailyTs.length} daily timestamps from ${new Date(firstMidnightUTC * 1000).toISOString().slice(0, 10)} to ${new Date(todayMidnightUTC * 1000).toISOString().slice(0, 10)}`,
      );

      // Check if we have a reasonable number of days to process
      if (dailyTs.length === 0) {
        this.logger.warn(`No days to process for source ${source.id}`);
        return;
      }

      // Prices preload
      if (!STABLECOIN_PRICES[asset.symbol]) {
        try {
          const firstDate = new Date(firstMidnightUTC * 1000);
          await this.priceService.getHistoricalPrice(
            { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
            firstDate,
          );
          this.logger.log(`Price data preloaded for ${asset.symbol}`);
        } catch (error) {
          this.logger.warn(`Failed to preload price data for ${asset.symbol}: ${error.message}`);
        }
      } else {
        this.logger.log(`Skipping preload for stablecoin ${asset.symbol}`);
      }

      let processedCount = 0;
      let skippedCount = 0;

      const ABI = algorithm === Algorithm.COMET_STATS ? CometABI : MarketV2ABI;

      const contract = new ethers.Contract(contractAddress, ABI, provider) as any;
      const { symbol, decimals } = asset;

      for (const targetTs of dailyTs) {
        try {
          const blockTag = await this.blockService.findBlockByTimestamp(
            network,
            provider,
            targetTs,
            lastBlock,
          );

          const assetCompToken = { address: null, symbol: 'COMP', decimals: null };
          const compDate = new Date(targetTs * 1000);
          let priceComp: number;
          try {
            priceComp = await this.priceService.getHistoricalPrice(assetCompToken, compDate);
            if (priceComp <= 0) {
              throw new Error(`Invalid price received: ${priceComp}`);
            }
          } catch (priceError: any) {
            const message = `Price fetch failed for ${asset.symbol} on ${compDate.toISOString().slice(0, 10)}: ${priceError.message}. Stopping to retry on next cron run.`;
            this.logger.error(message);
            await this.mailService.notifyGetHistoryError(message);
            return;
          }

          let marketAccounting: ResponseStatsAlgorithm;
          try {
            switch (algorithm) {
              case Algorithm.COMET_STATS:
                marketAccounting = await this.algorithmService.cometStats(
                  contract,
                  blockTag,
                  decimals,
                  priceComp,
                );
                break;
              default:
                throw new Error(
                  `Unsupported algorithm: ${algorithm} for contract ${contractAddress} at network ${network}, asset ${asset.symbol}`,
                );
            }
          } catch (e: any) {
            if (e.code === 'CALL_EXCEPTION') {
              const message = `Skip ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)} block number ${blockTag} - reserves unavailable for contract ${contractAddress} at network ${network}, algorithm ${algorithm}, asset ${asset.symbol}`;
              this.logger.warn(message);
              lastBlock = blockTag;
              skippedCount++;
              await this.mailService.notifyGetHistoryError(message);
              continue;
            } else {
              throw e;
            }
          }

          const dayDate = new Date(targetTs * 1000);

          // Get price using PriceService
          let price = 1;
          try {
            price = await this.priceService.getHistoricalPrice(
              { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
              dayDate,
            );

            if (price <= 0) {
              throw new Error(`Invalid price received: ${price}`);
            }
          } catch (priceError) {
            const message = `Price fetch failed for ${symbol} on ${dayDate.toISOString().slice(0, 10)}: ${priceError.message}. Stopping to retry on next cron run.`;
            this.logger.error(message);
            await this.mailService.notifyGetHistoryError(message);

            // Stop processing - will retry from this date on next cron run
            return;
          }

          const incomeSupplyQuantity = marketAccounting.incomes.supply * price;
          const incomeBorrowQuantity = marketAccounting.incomes.borrow * price;
          const spendSupplyQuantity = marketAccounting.spends?.supplyUsd;
          const spendBorrowQuantity = marketAccounting.spends?.borrowUsd;

          const newIncomes = new IncomesEntity(
            source,
            blockTag,
            marketAccounting.incomes.supply.toString(),
            marketAccounting.incomes.borrow.toString(),
            price,
            priceComp,
            incomeSupplyQuantity,
            incomeBorrowQuantity,
            dayDate,
          );
          // Save spends only if provided by algorithm
          if (
            marketAccounting.spends !== undefined &&
            typeof spendSupplyQuantity === 'number' &&
            typeof spendBorrowQuantity === 'number'
          ) {
            const newSpends = new SpendsEntity(
              source,
              blockTag,
              marketAccounting.spends.supplyUsd.toString(),
              marketAccounting.spends.borrowUsd.toString(),
              price,
              priceComp,
              spendSupplyQuantity,
              spendBorrowQuantity,
              dayDate,
            );
            await this.historyService.createSpendsWithSource(newSpends);
          }
          await this.historyService.createIncomesWithSource(newIncomes);

          lastBlock = blockTag;
          processedCount++;

          if (processedCount % 50 === 0) {
            this.logger.log(
              `Progress: ${processedCount}/${dailyTs.length} days processed (${skippedCount} skipped)`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to process timestamp ${targetTs}: ${error.message}`);

          const blocksPerDay = this.blockService.getBlocksPerDay(network, lastBlock);
          lastBlock = lastBlock + blocksPerDay;
          skippedCount++;
          continue;
        }
      }

      // Calculate final statistics
      const totalAttempted = dailyTs.length;
      const successRate =
        totalAttempted > 0 ? Math.round((processedCount / totalAttempted) * 100) : 0;

      this.logger.log(
        `Completed: ${successRate}% success (${processedCount}/${totalAttempted} processed, ${skippedCount} skipped)`,
      );
    } catch (error) {
      const message = `Error processing source ${source.id} on ${network} for contract ${contractAddress}, algorithm ${algorithm}, asset ${asset.symbol}: ${error.message}`;
      this.logger.error(message);
      await this.mailService.notifyGetHistoryError(message);
    }
  }
}
