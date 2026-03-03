import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';
import type { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';
import { ProviderFactory } from 'modules/network/provider.factory';
import { NetworkService } from 'modules/network/network.service';

import type {
  BlockTimingConfigData,
  BlockTimingConfigItem,
  BlockTimingNetworkConfig,
  BlockTimingPeriod,
  CachedBlockData,
} from './block.types';

import {
  DAY_IN_SEC,
  HOUR_IN_SEC,
  MINUTE_IN_SEC,
  SAFE_BLOCK_LAG_TIME_IN_SEC,
  SEC_IN_MS,
} from '@app/common/constants';

@Injectable()
export class BlockService implements OnModuleInit {
  private readonly logger = new Logger(BlockService.name);
  private readonly ARBITRUM_WIDE_RANGE_THRESHOLD_BLOCKS = 100_000;
  private readonly LINEA_ALLOWED_SLIP_IN_SEC = 10 * MINUTE_IN_SEC;
  private readonly DEFAULT_ALLOWED_SLIP_IN_SEC = HOUR_IN_SEC;
  private readonly ESTIMATION_SEARCH_PADDING_BLOCKS = 500;
  private readonly BLOCK_CACHE_TTL_DAYS = 30;
  private readonly BINARY_SEARCH_MAX_ITERATIONS = 25;
  private readonly ARBITRUM_FAST_PATH_WINDOW_IN_SEC = 7 * DAY_IN_SEC;
  private readonly ARBITRUM_SEARCH_RANGE_IN_SEC = HOUR_IN_SEC;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly providerFactory: ProviderFactory,
    private readonly networkService: NetworkService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Ensure all configured networks have block timing data before any block-based operations run.
    this.validateBlockTimingConfiguration();
    await this.initializeRedis();
  }

  async getSafeBlockNumber(network: string): Promise<number> {
    const provider = this.providerFactory.get(network);
    const latestBlock = await provider.getBlock('latest');

    if (!latestBlock) {
      throw new Error(`Could not fetch latest block for network ${network}`);
    }

    const blockOffset = this.getBlockOffsetByTimeForBlock(
      network,
      SAFE_BLOCK_LAG_TIME_IN_SEC,
      latestBlock.number,
    );

    return Math.max(0, latestBlock.number - blockOffset);
  }

  async getBlockOffsetByTime(network: string, timeInSeconds: number): Promise<number> {
    const provider = this.providerFactory.get(network);
    const latestBlock = await provider.getBlock('latest');

    if (!latestBlock) {
      throw new Error(`Could not fetch latest block for network ${network}`);
    }

    return this.getBlockOffsetByTimeForBlock(network, timeInSeconds, latestBlock.number);
  }

  async getCachedBlock(
    network: string,
    provider: JsonRpcProvider,
    blockNumber: number,
  ): Promise<{ blockNumber: number; timestamp: number; hash: string }> {
    const cachedBlock = await this.getBlockFromCache(network, blockNumber);
    if (cachedBlock) {
      return {
        blockNumber: cachedBlock.blockNumber,
        timestamp: cachedBlock.timestamp,
        hash: cachedBlock.hash,
      };
    }

    const block = await provider.getBlock(blockNumber);
    if (!block || !block.hash) {
      throw new Error(`Could not fetch block ${blockNumber}`);
    }

    await this.setBlockToCache(network, blockNumber, block.timestamp, block.hash);

    return { blockNumber: block.number, timestamp: block.timestamp, hash: block.hash };
  }

  async findBlockByTimestamp(
    network: string,
    provider: JsonRpcProvider,
    targetTs: number,
    fromBlock = 0,
    toBlock?: number,
  ): Promise<number> {
    const upperBound = toBlock ?? (await provider.getBlockNumber());

    if (
      network === 'arbitrum' &&
      upperBound - fromBlock > this.ARBITRUM_WIDE_RANGE_THRESHOLD_BLOCKS
    ) {
      return this.findArbitrumBlockByTimestamp(provider, targetTs, fromBlock, upperBound);
    }

    if (network === 'scroll') {
      return this.findScrollBlockByTimestamp(provider, targetTs, fromBlock, upperBound);
    }

    const networkConf = this.getNetworkConfigForBlock(network, fromBlock);
    const avgBlockTime = networkConf.avgBlockTime;

    const referenceBlock = await this.getCachedBlock(network, provider, fromBlock);
    const timeDiff = targetTs - referenceBlock.timestamp;
    const blockDiff = Math.round(timeDiff / avgBlockTime);
    let estimatedBlock = referenceBlock.blockNumber + blockDiff;

    estimatedBlock = Math.max(fromBlock, Math.min(upperBound, estimatedBlock));

    const estimatedBlockData = await this.getCachedBlock(network, provider, estimatedBlock);

    const allowedSlip =
      network === 'linea' ? this.LINEA_ALLOWED_SLIP_IN_SEC : this.DEFAULT_ALLOWED_SLIP_IN_SEC;
    if (Math.abs(estimatedBlockData.timestamp - targetTs) < allowedSlip) {
      return estimatedBlock;
    }

    const timeError = estimatedBlockData.timestamp - targetTs;
    const blockCorrection = Math.round(timeError / avgBlockTime);
    const searchStart = Math.max(
      fromBlock,
      estimatedBlock - Math.abs(blockCorrection) - this.ESTIMATION_SEARCH_PADDING_BLOCKS,
    );
    const searchEnd = Math.min(
      upperBound,
      estimatedBlock - blockCorrection + this.ESTIMATION_SEARCH_PADDING_BLOCKS,
    );

    return this.binarySearchWithCache(network, provider, targetTs, searchStart, searchEnd);
  }

  getBlocksPerDay(network: string, blockNumber: number): number {
    const networkConfig = this.getNetworkConfigForBlock(network, blockNumber);
    return networkConfig.blocksPerDay;
  }

  private async initializeRedis(): Promise<void> {
    try {
      const pong = await this.redisClient.ping();
      this.logger.log(`Redis client initialized. Ping: ${pong}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis initialization error: ${message}`);
    }
  }

  private validateBlockTimingConfiguration(): void {
    const networkNames = this.networkService
      .all()
      .map((network) => network.network)
      .sort();
    const blockTimingNetworkNames = Object.keys(this.timingConfig.networks).sort();

    const missingInBlockTiming = networkNames.filter(
      (networkName) => !blockTimingNetworkNames.includes(networkName),
    );
    const extraInBlockTiming = blockTimingNetworkNames.filter(
      (networkName) => !networkNames.includes(networkName),
    );

    if (missingInBlockTiming.length > 0) {
      throw new Error(
        `Block timing configuration is incomplete. Missing networks in blockTiming: ${missingInBlockTiming.join(', ')}. Network config contains: ${networkNames.join(', ')}. Block timing contains: ${blockTimingNetworkNames.join(', ')}.`,
      );
    }

    if (extraInBlockTiming.length > 0) {
      this.logger.warn(
        `Block timing contains extra networks not present in network config: ${extraInBlockTiming.join(', ')}.`,
      );
    }
  }

  private get timingConfig(): BlockTimingConfigData {
    const config = this.configService.get<BlockTimingConfigData>('blockTiming');
    if (!config) {
      throw new Error('Block timing configuration is missing at config key "blockTiming"');
    }

    return config;
  }

  private async getBlockFromCache(
    network: string,
    blockNumber: number,
  ): Promise<CachedBlockData | null> {
    try {
      const key = `block:${network}:${blockNumber}`;
      let cachedRaw: unknown;

      if (this.redisClient?.get) {
        cachedRaw = await this.redisClient.get(key);
      } else {
        cachedRaw = await this.cacheManager.get(key);
      }

      if (!cachedRaw) {
        return null;
      }

      const parsedValue =
        typeof cachedRaw === 'string' ? (JSON.parse(cachedRaw) as unknown) : (cachedRaw as unknown);

      return this.isCachedBlockData(parsedValue) ? parsedValue : null;
    } catch {
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
      const blockData: CachedBlockData = {
        blockNumber,
        timestamp,
        hash,
        cachedAt: Date.now(),
      };
      const ttlSeconds = this.BLOCK_CACHE_TTL_DAYS * DAY_IN_SEC;

      if (this.redisClient) {
        await this.redisClient.setex(key, ttlSeconds, JSON.stringify(blockData));
        return;
      }

      await this.cacheManager.set(key, JSON.stringify(blockData), ttlSeconds * SEC_IN_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Block cache SET error: ${message}`);
    }
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

    while (left < right && iterations < this.BINARY_SEARCH_MAX_ITERATIONS) {
      iterations++;
      const mid = Math.floor((left + right) / 2);

      try {
        const midBlock = await this.getCachedBlock(network, provider, mid);

        if (midBlock.timestamp < targetTs) {
          left = mid + 1;
        } else {
          right = mid;
        }
      } catch {
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
    if (timeDiff < this.ARBITRUM_FAST_PATH_WINDOW_IN_SEC) {
      const estimatedBlockDiff = Math.round(timeDiff / startPeriod.avgBlockTime);
      let estimatedBlock = fromBlock + estimatedBlockDiff;
      estimatedBlock = Math.max(fromBlock, Math.min(toBlock, estimatedBlock));

      const searchRange = Math.round(this.ARBITRUM_SEARCH_RANGE_IN_SEC / startPeriod.avgBlockTime);
      const searchStart = Math.max(fromBlock, estimatedBlock - searchRange);
      const searchEnd = Math.min(toBlock, estimatedBlock + searchRange);

      return this.binarySearchWithCache('arbitrum', provider, targetTs, searchStart, searchEnd);
    }

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

      if (Math.abs(nextBlockData.timestamp - targetTs) < this.ARBITRUM_SEARCH_RANGE_IN_SEC) {
        const searchRange = Math.round(
          this.ARBITRUM_SEARCH_RANGE_IN_SEC / currentPeriod.avgBlockTime,
        );
        const searchStart = Math.max(fromBlock, nextBlock - searchRange);
        const searchEnd = Math.min(toBlock, nextBlock + searchRange);

        return this.binarySearchWithCache('arbitrum', provider, targetTs, searchStart, searchEnd);
      }

      currentBlock = nextBlock;
      currentTimestamp = nextBlockData.timestamp;
    }

    return currentBlock;
  }

  private async findScrollBlockByTimestamp(
    provider: JsonRpcProvider,
    targetTs: number,
    fromBlock: number,
    toBlock: number,
  ): Promise<number> {
    let left = fromBlock;
    let right = toBlock;
    let result = left;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midBlock = await this.getCachedBlock('scroll', provider, mid);

      if (midBlock.timestamp < targetTs) {
        left = mid + 1;
      } else {
        result = mid;
        right = mid - 1;
      }
    }

    return result;
  }

  private getArbitrumConfigForBlock(blockNumber: number): BlockTimingPeriod {
    return this.getNetworkPeriodConfigForBlock('arbitrum', blockNumber);
  }

  private getScrollConfigForBlock(blockNumber: number): BlockTimingPeriod {
    return this.getNetworkPeriodConfigForBlock('scroll', blockNumber);
  }

  private getNetworkConfigForBlock(network: string, blockNumber: number): BlockTimingConfigItem {
    const networkConfig = this.getNetworkConfig(network);
    if (networkConfig.mode === 'fixed') {
      return networkConfig;
    }

    return this.getPeriodForBlock(networkConfig.periods, blockNumber);
  }

  private getNetworkPeriodConfigForBlock(network: string, blockNumber: number): BlockTimingPeriod {
    const networkConfig = this.getNetworkConfig(network);

    if (networkConfig.mode !== 'periods') {
      throw new Error(`Network ${network} does not have block timing periods configured`);
    }

    return this.getPeriodForBlock(networkConfig.periods, blockNumber);
  }

  private getNetworkConfig(network: string): BlockTimingNetworkConfig {
    const networkConfig = this.timingConfig.networks[network];
    if (!networkConfig) {
      throw new Error(`Block timing is not configured for network: ${network}`);
    }

    return networkConfig;
  }

  private getBlockOffsetByTimeForBlock(
    network: string,
    timeInSeconds: number,
    blockNumber: number,
  ): number {
    const normalizedTimeInSeconds = Math.max(0, timeInSeconds);
    if (normalizedTimeInSeconds === 0) {
      return 0;
    }

    const networkConfig = this.getNetworkConfigForBlock(network, blockNumber);
    return Math.max(1, Math.ceil(normalizedTimeInSeconds / networkConfig.avgBlockTime));
  }

  private getPeriodForBlock(periods: BlockTimingPeriod[], blockNumber: number): BlockTimingPeriod {
    for (const period of periods) {
      if (blockNumber >= period.startBlock && blockNumber <= period.endBlock) {
        return period;
      }
    }

    return periods[periods.length - 1];
  }

  private isCachedBlockData(value: unknown): value is CachedBlockData {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<CachedBlockData>;
    if (typeof candidate.blockNumber !== 'number') {
      return false;
    }
    if (typeof candidate.timestamp !== 'number') {
      return false;
    }
    if (typeof candidate.hash !== 'string') {
      return false;
    }
    return typeof candidate.cachedAt === 'number';
  }
}
