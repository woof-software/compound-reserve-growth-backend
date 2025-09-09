import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers, JsonRpcProvider } from 'ethers';
import type { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';
import { ProviderFactory } from 'modules/network/provider.factory';
import { HistoryService } from 'modules/history/history.service';
import { Reserve, Spends, Incomes } from 'modules/history/entities';
import { Source } from 'modules/source/source.entity';
import { SourceService } from 'modules/source/source.service';
import { PriceService } from 'modules/price/price.service';
import { MailService } from 'modules/mail/mail.service';
import { STABLECOIN_PRICES } from 'modules/price/constants';

import CometABI from './abi/CometABI.json';
import CometExtensionABI from './abi/CometExtensionABI.json';
import ComptrollerABI from './abi/ComptrollerABI.json';
import MarketV2ABI from './abi/MarketV2ABI.json';
import RewardsABI from './abi/RewardsABI.json';
import LegacyRewardsABI from './abi/LegacyRewardsABI.json';
import ERC20ABI from './abi/ERC20ABI.json';
import Bytes32TokenABI from './abi/Bytes32TokenABI.json';
import { MarketData, RootJson } from './contract.type';
import {
  CachedBlock,
  ResponseAlgorithm,
  DailyProcessArgs,
  DailyProcessOutcome,
  MarketAccountingArgs,
  PersistAccountingArgs,
} from './interface';

import {
  DAY_IN_SEC,
  MARKET_DECIMALS,
  PERCENT_PRECISION_SCALE_BI,
  SEC_IN_MS,
  YEAR_IN_DAYS,
  YEAR_IN_SECONDS,
} from '@app/common/constants';
import { Algorithm } from '@app/common/enum/algorithm.enum';
import { scaleToDecimals } from '@app/common/utils/scale-to-decimals';
import { percentToFp } from '@app/common/utils/percent-to-fp';

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

  private getMarketAccounting(
    reserves: bigint,
    totalSupply: bigint,
    totalBorrows: bigint,
    earnApr: number,
    borrowApr: number,
    supplyCompRewards: number,
    borrowCompRewards: number,
  ): ResponseAlgorithm {
    const borrowIncome =
      (totalBorrows * percentToFp(borrowApr)) / (100n * PERCENT_PRECISION_SCALE_BI);
    const borrowSpend =
      (totalBorrows * percentToFp(borrowCompRewards)) / (100n * PERCENT_PRECISION_SCALE_BI);
    const supplyIncome = (totalSupply * percentToFp(earnApr)) / (100n * PERCENT_PRECISION_SCALE_BI);
    const supplySpend =
      (totalSupply * percentToFp(supplyCompRewards)) / (100n * PERCENT_PRECISION_SCALE_BI);

    return {
      reserves,
      incomes: { supply: supplyIncome, borrow: borrowIncome },
      spends: { supply: supplySpend, borrow: borrowSpend },
    };
  }

  private async cometAlgorithms(
    contract: ethers.Contract,
    blockTag: number,
    decimals: number,
  ): Promise<ResponseAlgorithm> {
    const reserves: bigint = await contract.getReserves({ blockTag });
    const totalSupply: bigint = await contract.totalSupply({ blockTag });
    const totalBorrows: bigint = await contract.totalBorrow({ blockTag });
    const utilization: bigint = await contract.getUtilization({ blockTag });
    const supplyRatePerSec: bigint = await contract.getSupplyRate(utilization, { blockTag });
    const borrowRatePerSec: bigint = await contract.getBorrowRate(utilization, { blockTag });
    const trackingIndexScale: bigint = await contract.trackingIndexScale({ blockTag });
    const trackingIndexDecimals = scaleToDecimals(trackingIndexScale);
    const earnApr = Number(
      ethers.formatUnits(supplyRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );
    const baseTrackingSupplySpeed: bigint = await contract.baseTrackingSupplySpeed({
      blockTag,
    });
    const baseTrackingBorrowSpeed: bigint = await contract.baseTrackingBorrowSpeed({
      blockTag,
    });
    const annualSupplyRewardTokens = Number(
      ethers.formatUnits(baseTrackingSupplySpeed * BigInt(YEAR_IN_SECONDS), trackingIndexDecimals),
    );
    const annualBorrowRewardTokens = Number(
      ethers.formatUnits(baseTrackingBorrowSpeed * BigInt(YEAR_IN_SECONDS), trackingIndexDecimals),
    );
    const totalSupplyQuantity = Number(ethers.formatUnits(totalSupply, decimals));
    const totalBorrowsQuantity = Number(ethers.formatUnits(totalBorrows, decimals));

    const supplyCompRewards =
      totalSupplyQuantity > 0 ? (annualSupplyRewardTokens / totalSupplyQuantity) * 100 : 0;

    const borrowCompRewards =
      totalBorrowsQuantity > 0 ? (annualBorrowRewardTokens / totalBorrowsQuantity) * 100 : 0;

    return this.getMarketAccounting(
      reserves,
      totalSupply,
      totalBorrows,
      earnApr,
      borrowApr,
      supplyCompRewards,
      borrowCompRewards,
    );
  }

  private async marketV2Algorithms(
    contract: ethers.Contract,
    blockTag: number,
    decimals: number,
    provider: ethers.JsonRpcProvider,
    contractAddress: string,
    network: string,
  ): Promise<ResponseAlgorithm> {
    const reserves = await contract.totalReserves({ blockTag });
    const totalSupply = await contract.totalSupply({ blockTag });
    const totalBorrows = await contract.totalBorrows({ blockTag });
    const supplyRatePerBlock: bigint = await contract.supplyRatePerBlock({ blockTag });
    const borrowRatePerBlock: bigint = await contract.borrowRatePerBlock({ blockTag });
    const networkConf = this.networkConfig[network];
    const blocksPerYear = BigInt(networkConf.blocksPerDay) * BigInt(YEAR_IN_DAYS);
    const earnApr = Number(
      ethers.formatUnits(supplyRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const comptrollerAddress = await contract.comptroller({ blockTag });
    const comptroller = new ethers.Contract(comptrollerAddress, ComptrollerABI, provider);
    const compAddress = await comptroller.getCompAddress();
    const compSpeedPerBlock: bigint = await comptroller.compSpeeds(contractAddress, {
      blockTag,
    });
    const compTokenContract = new ethers.Contract(compAddress, ERC20ABI, provider);
    const compDecimals: number = await compTokenContract.decimals();
    const compPerYearWei: bigint = compSpeedPerBlock * blocksPerYear;
    const compPerYearTokens = Number(ethers.formatUnits(compPerYearWei, compDecimals));
    const totalBorrowsTokens = Number(ethers.formatUnits(totalBorrows, decimals));
    const totalSupplyTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const supplyCompRewards =
      totalSupplyTokens > 0 ? (compPerYearTokens / totalSupplyTokens) * 100 : 0;
    const borrowCompRewards =
      totalBorrowsTokens > 0 ? (compPerYearTokens / totalBorrowsTokens) * 100 : 0;

    return this.getMarketAccounting(
      reserves,
      totalSupply,
      totalBorrows,
      earnApr,
      borrowApr,
      supplyCompRewards,
      borrowCompRewards,
    );
  }

  async getHistory(source: Source) {
    const { address: contractAddress, network, asset, algorithm } = source;
    const { address: assetAddress } = asset;

    this.logger.log(
      `Starting history collection for source ${source.id} on ${network}, algorithm: ${algorithm}`,
    );

    try {
      const provider = this.providerFactory.get(network);

      let lastBlock = source.blockNumber;
      const startBlockData = await this.getCachedBlock(network, provider, lastBlock);
      const startTs = startBlockData.timestamp;

      const { firstMidnightUTC, todayMidnightUTC } = this.getDayBounds(startTs);
      const dailyTs = this.buildDailyTimestamps(firstMidnightUTC, todayMidnightUTC);

      if (dailyTs.length === 0) {
        this.logger.log(`No historical data needed - source is already up to date`);
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

      await this.preloadPrices(asset, firstMidnightUTC);

      let processedCount = 0;
      let skippedCount = 0;

      const abi = this.getAlgorithmAbi(algorithm);
      const contract = new ethers.Contract(contractAddress, abi, provider) as any;
      const assetContract = new ethers.Contract(assetAddress, ERC20ABI, provider) as any;

      for (const targetTs of dailyTs) {
        try {
          const result = await this.processOneDay({
            targetTs,
            lastBlock,
            source,
            network,
            provider,
            asset,
            algorithm,
            contract,
            assetContract,
            contractAddress,
          });

          if (result.stop) {
            return; // Stop processing to retry on next cron run
          }

          lastBlock = result.lastBlock;
          processedCount += result.processedDelta;
          skippedCount += result.skippedDelta;

          if (processedCount > 0 && processedCount % 50 === 0) {
            this.logger.log(
              `Progress: ${processedCount}/${dailyTs.length} days processed (${skippedCount} skipped)`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to process timestamp ${targetTs}: ${error.message}`);
          lastBlock = this.advanceBlockOnError(network, lastBlock);
          skippedCount++;
          continue;
        }
      }

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

  private getDayBounds(startTs: number): { firstMidnightUTC: number; todayMidnightUTC: number } {
    const firstMidnightUTC = Math.floor(startTs / DAY_IN_SEC + 1) * DAY_IN_SEC;
    const now = Math.floor(Date.now() / SEC_IN_MS);
    const todayMidnightUTC = Math.floor(now / DAY_IN_SEC) * DAY_IN_SEC;
    return { firstMidnightUTC, todayMidnightUTC };
  }

  private buildDailyTimestamps(startTs: number, endTs: number): number[] {
    const dailyTs: number[] = [];
    for (let ts = startTs; ts <= endTs; ts += DAY_IN_SEC) {
      dailyTs.push(ts);
    }
    return dailyTs;
  }

  private async preloadPrices(
    asset: { address: string; symbol: string; decimals: number },
    firstMidnightUTC: number,
  ): Promise<void> {
    if (!STABLECOIN_PRICES[asset.symbol]) {
      try {
        const firstDate = new Date(firstMidnightUTC * 1000);
        await this.priceService.getHistoricalPrice(
          { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
          firstDate,
        );
        this.logger.log(`Price data preloaded for ${asset.symbol}`);
      } catch (error: any) {
        this.logger.warn(`Failed to preload price data for ${asset.symbol}: ${error.message}`);
      }
    } else {
      this.logger.log(`Skipping preload for stablecoin ${asset.symbol}`);
    }
  }

  private getAlgorithmAbi(algorithm: Algorithm | string): any {
    return algorithm === Algorithm.COMET ? CometABI : MarketV2ABI;
  }

  private async computeMarketAccounting(params: MarketAccountingArgs): Promise<ResponseAlgorithm> {
    const {
      algorithm,
      contract,
      blockTag,
      decimals,
      provider,
      contractAddress,
      network,
      asset,
      assetContract,
    } = params;

    switch (algorithm) {
      case Algorithm.COMET:
        return this.cometAlgorithms(contract, blockTag, decimals);
      case Algorithm.MARKET_V2:
        return this.marketV2Algorithms(
          contract,
          blockTag,
          decimals,
          provider,
          contractAddress,
          network,
        );
      default: {
        const reserves: bigint =
          asset.symbol === 'ETH' || asset.symbol === 'MNT'
            ? await provider.getBalance(contractAddress, blockTag)
            : await assetContract.balanceOf(contractAddress, { blockTag });
        return {
          reserves,
          incomes: { supply: 0n, borrow: 0n },
          spends: { supply: 0n, borrow: 0n },
        };
      }
    }
  }

  private async fetchPriceOrStop(
    asset: { address: string; symbol: string; decimals: number },
    date: Date,
  ): Promise<number | null> {
    try {
      const price = await this.priceService.getHistoricalPrice(
        { address: asset.address, symbol: asset.symbol, decimals: asset.decimals },
        date,
      );
      if (price <= 0) {
        throw new Error(`Invalid price received: ${price}`);
      }
      return price;
    } catch (priceError: any) {
      const message = `Price fetch failed for ${asset.symbol} on ${date.toISOString().slice(0, 10)}: ${priceError.message}. Stopping to retry on next cron run.`;
      this.logger.error(message);
      await this.mailService.notifyGetHistoryError(message);
      return null;
    }
  }

  private isInvalidValue(value: number): boolean {
    return isNaN(value) || value < 0;
  }

  private validateAndCalculateQuantity(
    amount: bigint,
    decimals: number,
    price: number,
    fieldName: string,
  ): { value: number; isValid: boolean } {
    const quantity = ethers.formatUnits(amount, decimals);
    const value = Number(quantity) * price;

    this.logger.debug(
      `Calculating ${fieldName}: amount=${amount}, quantity=${quantity}, price=${price}, value=${value}`,
    );

    if (this.isInvalidValue(value)) {
      this.logger.warn(`Invalid ${fieldName} value: ${value}, skipping`);
      return { value, isValid: false };
    }

    return { value, isValid: true };
  }

  private advanceBlockOnError(network: string, lastBlock: number): number {
    if (network === 'arbitrum') {
      const period = this.getArbitrumConfigForBlock(lastBlock);
      return lastBlock + period.blocksPerDay;
    }
    const networkConf = this.networkConfig[network];
    return lastBlock + (networkConf?.blocksPerDay || 43200);
  }

  private async persistCreateAndUpdate(
    persistAccountingArgs: PersistAccountingArgs,
  ): Promise<void> {
    const {
      source,
      blockTag,
      marketAccounting,
      price,
      reserveValue,
      incomeSupplyValue,
      incomeBorrowValue,
      spendSupplyValue,
      spendBorrowValue,
      date,
    } = persistAccountingArgs;

    const newReserve = new Reserve(
      source,
      blockTag,
      marketAccounting.reserves.toString(),
      price,
      reserveValue,
      date,
    );
    const newIncomes = new Incomes(
      source,
      blockTag,
      marketAccounting.incomes.supply.toString(),
      marketAccounting.incomes.borrow.toString(),
      price,
      incomeSupplyValue,
      incomeBorrowValue,
      date,
    );
    const newSpends = new Spends(
      source,
      blockTag,
      marketAccounting.spends.supply.toString(),
      marketAccounting.spends.borrow.toString(),
      price,
      spendSupplyValue,
      spendBorrowValue,
      date,
    );

    await this.historyService.createReservesWithSource(newReserve);
    await this.historyService.createIncomesWithSource(newIncomes);
    await this.historyService.createSpendsWithSource(newSpends);
    await this.sourceService.updateWithSource({
      source,
      blockNumber: blockTag,
      checkedAt: new Date(),
    });
  }

  private async processOneDay(params: DailyProcessArgs): Promise<DailyProcessOutcome> {
    const {
      targetTs,
      lastBlock,
      source,
      network,
      provider,
      asset,
      algorithm,
      contract,
      assetContract,
      contractAddress,
    } = params;

    const blockTag = await this.findBlockByTimestamp(network, provider, targetTs, lastBlock);

    let marketAccounting: ResponseAlgorithm;
    try {
      marketAccounting = await this.computeMarketAccounting({
        algorithm,
        contract,
        blockTag,
        decimals: asset.decimals,
        provider,
        contractAddress,
        network,
        asset,
        assetContract,
      });
    } catch (e: any) {
      if (e.code === 'CALL_EXCEPTION') {
        const message = `Skip ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)} block number ${blockTag} — reserves unavailable for contract ${contractAddress} at network ${network}, algorithm ${algorithm}, asset ${asset.symbol}`;
        this.logger.warn(message);
        await this.mailService.notifyGetHistoryError(message);
        return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
      }
      throw e;
    }

    const date = new Date(targetTs * 1000);
    const price = await this.fetchPriceOrStop(asset, date);
    if (price === null) {
      return { lastBlock, processedDelta: 0, skippedDelta: 0, stop: true };
    }

    // Validate and calculate all quantity
    const reserveQuantity = this.validateAndCalculateQuantity(
      marketAccounting.reserves,
      asset.decimals,
      price,
      'reserve',
    );
    if (!reserveQuantity.isValid) {
      this.logger.warn(
        `Reserve validation failed, skipping day ${new Date(targetTs * SEC_IN_MS).toISOString().slice(0, 10)}`,
      );
      return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
    }

    const incomeSupplyQuantity = this.validateAndCalculateQuantity(
      marketAccounting.incomes.supply,
      asset.decimals,
      price,
      'supply income',
    );
    if (!incomeSupplyQuantity.isValid) {
      return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
    }

    const incomeBorrowQuantity = this.validateAndCalculateQuantity(
      marketAccounting.incomes.borrow,
      asset.decimals,
      price,
      'borrow income',
    );
    if (!incomeBorrowQuantity.isValid) {
      return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
    }

    const spendSupplyQuantity = this.validateAndCalculateQuantity(
      marketAccounting.spends.supply,
      asset.decimals,
      price,
      'supply spend',
    );
    if (!spendSupplyQuantity.isValid) {
      return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
    }

    const spendBorrowQuantity = this.validateAndCalculateQuantity(
      marketAccounting.spends.borrow,
      asset.decimals,
      price,
      'borrow spend',
    );
    if (!spendBorrowQuantity.isValid) {
      return { lastBlock: blockTag, processedDelta: 0, skippedDelta: 1, stop: false };
    }

    await this.persistCreateAndUpdate({
      source,
      blockTag,
      marketAccounting,
      price,
      reserveValue: reserveQuantity.value,
      incomeSupplyValue: incomeSupplyQuantity.value,
      incomeBorrowValue: incomeBorrowQuantity.value,
      spendSupplyValue: spendSupplyQuantity.value,
      spendBorrowValue: spendBorrowQuantity.value,
      date,
    });
    return { lastBlock: blockTag, processedDelta: 1, skippedDelta: 0, stop: false };
  }
}
