import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers, JsonRpcProvider } from 'ethers';
import type { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { Reserve, Spends, Incomes } from 'modules/history/entities';
import { REDIS_CLIENT } from 'modules/redis/redis.module';
import { ProviderFactory } from 'modules/network/provider.factory';
import { HistoryService } from 'modules/history/history.service';
import { Source } from 'modules/source/source.entity';
import { SourceService } from 'modules/source/source.service';
import { PriceService } from 'modules/price/price.service';
import { MailService } from 'modules/mail/mail.service';
import { STABLECOIN_PRICES } from 'modules/price/constants';
import { AlgorithmService } from 'modules/contract/algorithm.service';

import CometABI from './abi/CometABI.json';
import CometExtensionABI from './abi/CometExtensionABI.json';
import ComptrollerABI from './abi/ComptrollerABI.json';
import MarketV2ABI from './abi/MarketV2ABI.json';
import RewardsABI from './abi/RewardsABI.json';
import LegacyRewardsABI from './abi/LegacyRewardsABI.json';
import ERC20ABI from './abi/ERC20ABI.json';
import Bytes32TokenABI from './abi/Bytes32TokenABI.json';
import { MarketData, RootJson } from './contract.type';
import { CachedBlock, ResponseStatsAlgorithm } from './interface';

import { DAY_IN_SEC, SEC_IN_MS } from '@app/common/constants';
import { Algorithm } from '@app/common/enum/algorithm.enum';
import { calculateTimeRange } from '@/common/utils/calculate-time-range';

@Injectable()
export class ContractService implements OnModuleInit {
  private readonly logger = new Logger(ContractService.name);

  // Network configuration
  private networkConfig = {
    mainnet: { avgBlockTime: 12, blocksPerDay: 7200 },
    arbitrum: { avgBlockTime: 0.3, blocksPerDay: 288000 },
    base: { avgBlockTime: 2, blocksPerDay: 43200 },
    optimism: { avgBlockTime: 2, blocksPerDay: 43200 },
    polygon: { avgBlockTime: 2, blocksPerDay: 43200 },
    linea: { avgBlockTime: 2.5, blocksPerDay: 34560 },
    ronin: { avgBlockTime: 3, blocksPerDay: 28800 },
    scroll: { avgBlockTime: 3, blocksPerDay: 28800 },
    unichain: { avgBlockTime: 1, blocksPerDay: 86400 },
  };

  // Arbitrum periods
  private readonly arbitrumPeriods = [
    {
      startBlock: 0,
      endBlock: 22207817,
      avgBlockTime: 13.5,
      blocksPerDay: 6400,
      description: 'Classic',
    },
    {
      startBlock: 22207818,
      endBlock: 58000000,
      avgBlockTime: 1.0,
      blocksPerDay: 86400,
      description: 'Upgrade 1',
    },
    {
      startBlock: 58000001,
      endBlock: Infinity,
      avgBlockTime: 0.25,
      blocksPerDay: 345600,
      description: 'Upgrade 2',
    },
  ];

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly providerFactory: ProviderFactory,
    private readonly historyService: HistoryService,
    private readonly sourceService: SourceService,
    private readonly priceService: PriceService,
    private readonly algorithmService: AlgorithmService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const pong = await this.redisClient.ping();
      this.logger.log(`Redis client initialized. Ping: ${pong}`);
    } catch (err) {
      this.logger.error(`Redis initialization error: ${(err as Error).message}`);
    }
  }

  async readMarketData(root: RootJson, networkPath: string): Promise<MarketData> {
    const [networkKey] = networkPath.split('/');
    if (!networkKey) {
      this.logger.error(
        `Invalid networkPath format: '${root.networkPath}'. Expected format: 'network/market'`,
      );
      throw new Error(`Invalid networkPath format: '${root.networkPath}'`);
    }

    let provider: ethers.JsonRpcProvider;
    try {
      provider = this.providerFactory.get(networkKey);
    } catch (e) {
      this.logger.error(`Unsupported network '${networkKey}' in path '${root.networkPath}'`);
      throw e;
    }

    const cometAddress = root.comet;
    const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

    const extensionDelegateAddress = await cometContract.extensionDelegate();
    const extensionDelegateContract = new ethers.Contract(
      extensionDelegateAddress,
      CometExtensionABI,
      provider,
    ) as any;

    const cometSymbol = await extensionDelegateContract.symbol();

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

      const comptrollerContract = new ethers.Contract(
        comptrollerAddress,
        ComptrollerABI,
        provider,
      ) as any;

      const allMarkets = await comptrollerContract.getAllMarkets();

      return allMarkets;
    } catch (error) {
      this.logger.error(`Error finding comptroller markets for ${comptrollerAddress}:`, error);
      throw error;
    }
  }

  async getMarketSymbol(marketAddress: string, network: string): Promise<string> {
    try {
      const provider = this.providerFactory.get(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const symbol = await marketContract.symbol();

      return symbol;
    } catch (error) {
      this.logger.error(`Error finding market symbol for ${marketAddress}:`, error);
      throw error;
    }
  }

  async getCometBaseToken(cometAddress: string, network: string) {
    try {
      const provider = this.providerFactory.get(network);

      const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

      const tokenAddress = await cometContract.baseToken();

      const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider) as any;

      const symbol = await tokenContract.symbol();

      const decimals = await tokenContract.decimals();

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      this.logger.error(`Error getting comet ${cometAddress} base token:`, error);
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

      const provider = this.providerFactory.get(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const tokenAddress = await marketContract.underlying();

      const bytes32Tokens = [
        '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      ];

      const tokenABI = bytes32Tokens.includes(tokenAddress) ? Bytes32TokenABI : ERC20ABI;

      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider) as any;

      const rawSymbol = await tokenContract.symbol();

      const symbol = bytes32Tokens.includes(tokenAddress)
        ? ethers.toUtf8String(rawSymbol).replace(/\u0000/g, '')
        : rawSymbol;

      const decimals = await tokenContract.decimals();

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      this.logger.error(
        `Error getting market v2 ${marketAddress} underlying token in network ${network}:`,
        error,
      );
      throw error;
    }
  }

  async getRewardsCompToken(
    rewardsAddress: string,
    cometAddress: string,
    network: string,
    provider: ethers.JsonRpcProvider,
  ) {
    const legacyNetworks = ['mainnet', 'polygon'];
    const rewardsABI = legacyNetworks.includes(network) ? LegacyRewardsABI : RewardsABI;
    const rewardsContract = new ethers.Contract(rewardsAddress, rewardsABI, provider) as any;

    const rewardConfig = await rewardsContract.rewardConfig(cometAddress);
    const tokenAddress = rewardConfig[0];
    return tokenAddress;
  }

  // ==================== BLOCK CACHE METHODS ====================

  private async getCachedBlock(
    network: string,
    provider: JsonRpcProvider,
    blockNumber: number,
  ): Promise<{ blockNumber: number; timestamp: number; hash: string }> {
    // Check cache
    const cached = await this.getBlockFromCache(network, blockNumber);
    if (cached) {
      return { blockNumber: cached.blockNumber, timestamp: cached.timestamp, hash: cached.hash };
    }

    // Fetch from network
    const block = await provider.getBlock(blockNumber);
    if (!block) {
      throw new Error(`Could not fetch block ${blockNumber}`);
    }

    // Cache it
    await this.setBlockToCache(network, blockNumber, block.timestamp, block.hash);

    return { blockNumber: block.number, timestamp: block.timestamp, hash: block.hash };
  }

  private async getBlockFromCache(
    network: string,
    blockNumber: number,
  ): Promise<CachedBlock | null> {
    try {
      const key = `block:${network}:${blockNumber}`;

      let cached: string | null = null;
      if (this.redisClient?.get) {
        cached = await this.redisClient.get(key);
      } else {
        cached = await this.cacheManager.get(key);
      }

      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  private async setBlockToCache(
    network: string,
    blockNumber: number,
    timestamp: number,
    hash: string,
  ): Promise<void> {
    try {
      const key = `block:${network}:${blockNumber}`;
      const blockData: CachedBlock = { blockNumber, timestamp, hash, cachedAt: Date.now() };
      const ttlSeconds = 30 * DAY_IN_SEC;

      if (this.redisClient) {
        await this.redisClient.setex(key, ttlSeconds, JSON.stringify(blockData));
      } else {
        await this.cacheManager.set(key, JSON.stringify(blockData), ttlSeconds * SEC_IN_MS);
      }
    } catch (error) {
      this.logger.warn(`Block cache SET error: ${(error as Error).message}`);
    }
  }

  // ==================== BLOCK SEARCH METHODS ====================

  async findBlockByTimestamp(
    network: string,
    provider: JsonRpcProvider,
    targetTs: number,
    fromBlock = 0,
    toBlock?: number,
  ): Promise<number> {
    toBlock = toBlock ?? (await provider.getBlockNumber());

    if (network === 'arbitrum' && toBlock - fromBlock > 100000) {
      return this.findArbitrumBlockByTimestamp(provider, targetTs, fromBlock, toBlock);
    }

    // Simple estimation based on network config
    const networkConf = this.networkConfig[network];
    const avgBlockTime = networkConf?.avgBlockTime || 2;

    const referenceBlock = await this.getCachedBlock(network, provider, fromBlock);
    const timeDiff = targetTs - referenceBlock.timestamp;
    const blockDiff = Math.round(timeDiff / avgBlockTime);
    let estimatedBlock = referenceBlock.blockNumber + blockDiff;

    estimatedBlock = Math.max(fromBlock, Math.min(toBlock, estimatedBlock));

    // Check accuracy
    const estimatedBlockData = await this.getCachedBlock(network, provider, estimatedBlock);

    const slip = network === 'linea' ? 600 : 3600; // 10 minutes for Linea, 1 hour for others
    if (Math.abs(estimatedBlockData.timestamp - targetTs) < slip) {
      return estimatedBlock;
    }

    // Binary search in narrow range
    const timeError = estimatedBlockData.timestamp - targetTs;
    const blockCorrection = Math.round(timeError / avgBlockTime);
    const searchStart = Math.max(fromBlock, estimatedBlock - Math.abs(blockCorrection) - 500);
    const searchEnd = Math.min(toBlock, estimatedBlock - blockCorrection + 500);

    return this.binarySearchWithCache(network, provider, targetTs, searchStart, searchEnd);
  }

  private async binarySearchWithCache(
    network: string,
    provider: JsonRpcProvider,
    targetTs: number,
    fromBlock: number,
    toBlock: number,
  ): Promise<number> {
    let left = fromBlock;
    let right = toBlock;
    let iterations = 0;

    while (left < right && iterations < 25) {
      iterations++;
      const mid = Math.floor((left + right) / 2);

      try {
        const midBlock = await this.getCachedBlock(network, provider, mid);

        if (midBlock.timestamp < targetTs) {
          left = mid + 1;
        } else {
          right = mid;
        }
      } catch (error) {
        left = mid + 1;
      }
    }

    return left;
  }

  private async findArbitrumBlockByTimestamp(
    provider: JsonRpcProvider,
    targetTs: number,
    fromBlock: number,
    toBlock: number,
  ): Promise<number> {
    const startPeriod = this.getArbitrumConfigForBlock(fromBlock);
    const referenceBlock = await this.getCachedBlock('arbitrum', provider, fromBlock);

    const timeDiff = targetTs - referenceBlock.timestamp;
    if (timeDiff < 7 * 24 * 3600) {
      const estimatedBlockDiff = Math.round(timeDiff / startPeriod.avgBlockTime);
      let estimatedBlock = fromBlock + estimatedBlockDiff;
      estimatedBlock = Math.max(fromBlock, Math.min(toBlock, estimatedBlock));

      const searchRange = Math.round(3600 / startPeriod.avgBlockTime);
      const searchStart = Math.max(fromBlock, estimatedBlock - searchRange);
      const searchEnd = Math.min(toBlock, estimatedBlock + searchRange);

      return this.binarySearchWithCache('arbitrum', provider, targetTs, searchStart, searchEnd);
    }

    // Handle period transitions for longer spans
    let currentBlock = fromBlock;
    const startBlockData = await this.getCachedBlock('arbitrum', provider, fromBlock);
    let currentTimestamp = startBlockData.timestamp;

    while (currentTimestamp < targetTs && currentBlock < toBlock) {
      const currentPeriod = this.getArbitrumConfigForBlock(currentBlock);
      const remainingTime = targetTs - currentTimestamp;
      const estimatedBlocksNeeded = Math.round(remainingTime / currentPeriod.avgBlockTime);

      const nextBlock = Math.min(
        currentBlock + estimatedBlocksNeeded,
        currentPeriod.endBlock,
        toBlock,
      );

      const nextBlockData = await this.getCachedBlock('arbitrum', provider, nextBlock);

      if (Math.abs(nextBlockData.timestamp - targetTs) < 3600) {
        const searchRange = Math.round(3600 / currentPeriod.avgBlockTime);
        const searchStart = Math.max(fromBlock, nextBlock - searchRange);
        const searchEnd = Math.min(toBlock, nextBlock + searchRange);
        return this.binarySearchWithCache('arbitrum', provider, targetTs, searchStart, searchEnd);
      }

      currentBlock = nextBlock;
      currentTimestamp = nextBlockData.timestamp;
    }

    return currentBlock;
  }

  private getArbitrumConfigForBlock(blockNumber: number): any {
    for (const period of this.arbitrumPeriods) {
      if (blockNumber >= period.startBlock && blockNumber <= period.endBlock) {
        return period;
      }
    }
    return this.arbitrumPeriods[this.arbitrumPeriods.length - 1];
  }

  async getHistory(source: Source) {
    const { algorithm } = source;

    for (const alg of algorithm) {
      switch (alg) {
        case Algorithm.COMET:
          await this.saveReserves(source, alg);
          break;
        case Algorithm.MARKET_V2:
          await this.saveReserves(source, alg);
          break;
        case Algorithm.COMET_STATS:
          await this.saveStats(source, alg);
          break;
        case Algorithm.MARKET_V2_STATS:
          await this.saveStats(source, alg);
          break;
        default:
          await this.saveReserves(source, alg);
      }
    }
  }

  private async saveReserves(source: Source, algorithm: string): Promise<void> {
    const { address: contractAddress, network, asset } = source;
    const { address: assetAddress } = asset;

    this.logger.log(
      `Starting history collection for source ${source.id} on ${network}, algorithm: ${algorithm}`,
    );

    try {
      const provider = this.providerFactory.get(network);

      let lastBlock = source.blockNumber;
      const startBlockData = await this.getCachedBlock(network, provider, lastBlock);
      const startTs = startBlockData.timestamp;

      const { firstMidnightUTC, todayMidnightUTC, dailyTs } = calculateTimeRange(startTs);

      // Check if we have any days to process
      if (firstMidnightUTC > todayMidnightUTC) {
        this.logger.log(`No historical data needed - source is already up to date`);

        // Update the source with current timestamp
        await this.sourceService.updateWithSource({
          source,
          blockNumber: lastBlock,
          checkedAt: new Date(),
        });

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
          const blockTag = await this.findBlockByTimestamp(network, provider, targetTs, lastBlock);

          let reserves: bigint;
          try {
            switch (algorithm) {
              case Algorithm.COMET:
                reserves = await this.algorithmService.comet(contract, blockTag);
                break;
              case Algorithm.MARKET_V2:
                reserves = await this.algorithmService.marketV2(contract, blockTag);
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
              const message = `Skip ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)} block number ${blockTag} — reserves unavailable for contract ${contractAddress} at network ${network}, algorithm ${algorithm}, asset ${asset.symbol}`;
              this.logger.warn(message);
              lastBlock = blockTag;
              skippedCount++;
              await this.mailService.notifyGetHistoryError(message);
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

          if (isNaN(value) || value < 0) {
            this.logger.warn(`Invalid value: ${value}, skipping`);
            lastBlock = blockTag;
            skippedCount++;
            continue;
          }

          const newHistory = new Reserve(source, blockTag, reserves.toString(), price, value, date);

          await this.historyService.createReservesWithSource(newHistory);

          await this.sourceService.updateWithSource({
            source,
            blockNumber: blockTag,
            checkedAt: new Date(),
          });

          lastBlock = blockTag;
          processedCount++;

          if (processedCount % 50 === 0) {
            this.logger.log(
              `Progress: ${processedCount}/${dailyTs.length} days processed (${skippedCount} skipped)`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to process timestamp ${targetTs}: ${error.message}`);

          // Fallback
          if (network === 'arbitrum') {
            const period = this.getArbitrumConfigForBlock(lastBlock);
            lastBlock = lastBlock + period.blocksPerDay;
          } else {
            const networkConf = this.networkConfig[network];
            lastBlock = lastBlock + (networkConf?.blocksPerDay || 43200);
          }
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

  private async saveStats(source: Source, algorithm: string): Promise<void> {
    const { address: contractAddress, network, asset } = source;

    this.logger.log(
      `Starting history collection for source ${source.id} on ${network}, algorithm: ${algorithm}`,
    );

    try {
      const provider = this.providerFactory.get(network);

      const spends = await this.historyService.findSpendsBySource(source);
      const incomes = await this.historyService.findIncomesBySource(source);

      let lastBlock: number | undefined;

      if (incomes?.blockNumber) {
        lastBlock = incomes.blockNumber;
      }
      if (spends?.blockNumber && (!lastBlock || spends.blockNumber < lastBlock)) {
        lastBlock = spends.blockNumber;
      }
      if (!lastBlock) {
        try {
          // Start from the contract creation block if we have no prior events
          const creationBlock = await this.getContractCreationBlock(source.address, source.network);
          lastBlock = Math.max(creationBlock, 0);
          this.logger.log(
            `No previous liquidation events. Starting scan from creation block ${lastBlock} for ${source.address} on ${source.network}`,
          );
        } catch (e: any) {
          this.logger.warn(
            `Failed to determine creation block for ${source.address} on ${source.network}: ${e?.message}. Fallback to source.blockNumber=${lastBlock}`,
          );
          return;
        }
      }

      const startBlockData = await this.getCachedBlock(network, provider, lastBlock);
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
          const blockTag = await this.findBlockByTimestamp(network, provider, targetTs, lastBlock);
          const blocksPerDay = this.networkConfig[network].blocksPerDay;

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
              case Algorithm.MARKET_V2_STATS:
                marketAccounting = await this.algorithmService.marketV2Stats(
                  contract,
                  blockTag,
                  blocksPerDay,
                  decimals,
                );
                break;
              default:
                throw new Error(
                  `Unsupported algorithm: ${algorithm} for contract ${contractAddress} at network ${network}, asset ${asset.symbol}`,
                );
            }
          } catch (e: any) {
            if (e.code === 'CALL_EXCEPTION') {
              const message = `Skip ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)} block number ${blockTag} — reserves unavailable for contract ${contractAddress} at network ${network}, algorithm ${algorithm}, asset ${asset.symbol}`;
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

          const newIncomes = new Incomes(
            source,
            blockTag,
            marketAccounting.incomes.supply.toString(),
            marketAccounting.incomes.borrow.toString(),
            price,
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
            const newSpends = new Spends(
              source,
              blockTag,
              marketAccounting.spends.supplyUsd.toString(),
              marketAccounting.spends.borrowUsd.toString(),
              price,
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

          // Fallback
          if (network === 'arbitrum') {
            const period = this.getArbitrumConfigForBlock(lastBlock);
            lastBlock = lastBlock + period.blocksPerDay;
          } else {
            const networkConf = this.networkConfig[network];
            lastBlock = lastBlock + (networkConf?.blocksPerDay || 43200);
          }
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
