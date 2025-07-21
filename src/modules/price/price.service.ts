import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';

import { PriceProviderInterface } from './interfaces/price-provider.interface';
import { CachedPrice } from './interfaces/cached-price.interface';
import { CoinGeckoProviderService } from './providers/coingecko/coingecko.service';
import { STABLECOIN_PRICES } from './constants';

import { DAY_IN_MS, DAY_IN_SEC, HOUR_IN_SEC, SEC_IN_MS } from '@app/common/constants';

@Injectable()
export class PriceService implements OnModuleInit {
  private readonly logger = new Logger(PriceService.name);
  private readonly providers: Map<string, PriceProviderInterface> = new Map();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly coinGeckoProvider: CoinGeckoProviderService,
  ) {
    this.registerProvider(this.coinGeckoProvider);
  }

  async onModuleInit() {
    await this.initializeRedis();
  }

  private registerProvider(provider: PriceProviderInterface): void {
    this.providers.set(provider.getProviderName(), provider);
    this.logger.log(`Registered price provider: ${provider.getProviderName()}`);
  }

  private async initializeRedis(): Promise<void> {
    try {
      const pong = await this.redisClient.ping();
      this.logger.log(`Redis client initialized. Ping: ${pong}`);
    } catch (err) {
      this.logger.error(`Redis initialization error: ${(err as Error).message}`);
    }
  }

  async getHistoricalPrice(
    asset: { address: string; symbol: string; decimals: number },
    date: Date,
  ): Promise<number> {
    // Check cache first
    const cachedPrice = await this.getFromCache(asset.symbol, date);
    if (cachedPrice) {
      this.logger.debug(
        `Price cache HIT: ${asset.symbol} @ ${date.toISOString().slice(0, 10)} = ${cachedPrice.price}`,
      );
      return cachedPrice.price;
    }

    let price: number | null = null;
    let source = '';

    try {
      // Check if stablecoin
      if (STABLECOIN_PRICES[asset.symbol]) {
        price = STABLECOIN_PRICES[asset.symbol];
        source = 'hardcoded';
      } else {
        // Try providers in order of preference
        const result = await this.fetchPriceFromProviders(asset, date);
        if (result) {
          price = result.price;
          source = result.source;
        }
      }

      // If still no price found, throw error
      if (price === null || price <= 0) {
        throw new Error(
          `No price data available for ${asset.symbol} on ${date.toISOString().slice(0, 10)}`,
        );
      }

      // Cache the result
      await this.setToCache(asset.symbol, date, price, source);
      return price;
    } catch (error) {
      this.logger.error(
        `Failed to get price for ${asset.symbol} on ${date.toISOString().slice(0, 10)}: ${error.message}`,
      );
      throw error;
    }
  }

  private async fetchPriceFromProviders(
    asset: { address: string; symbol: string; decimals: number },
    date: Date,
  ): Promise<{ price: number; source: string } | null> {
    for (const [providerName, provider] of this.providers) {
      try {
        const coinId = this.getCoinIdFromProvider(provider, asset.symbol);
        if (!coinId) {
          this.logger.debug(
            `No coinId mapping found for ${asset.symbol} in provider ${providerName}`,
          );
          continue;
        }

        const result = await this.getExactOrNearestPrice(provider, coinId, date);
        if (result) {
          return { price: result.price, source: result.source };
        }
      } catch (error) {
        this.logger.warn(`Provider ${providerName} failed for ${asset.symbol}: ${error.message}`);
        continue;
      }
    }

    return null;
  }

  private getCoinIdFromProvider(provider: PriceProviderInterface, symbol: string): string | null {
    const mappings = provider.getMappings();
    return mappings[symbol] || null;
  }

  private async getExactOrNearestPrice(
    provider: PriceProviderInterface,
    coinId: string,
    date: Date,
  ): Promise<{ price: number; source: string } | null> {
    const providerName = provider.getProviderName();
    const dateString = date.toISOString().slice(0, 10);

    // Calculate if the requested date is older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const isOlderThanOneYear = date < oneYearAgo;

    if (isOlderThanOneYear) {
      // For dates older than 1 year, use the earliest available price from the last year
      this.logger.debug(
        `Date ${dateString} is older than 1 year, looking for earliest available price`,
      );

      // First ensure we have the yearly data loaded
      const yearCacheKey = `year_loaded:${coinId}`;
      const yearLoaded = await this.getYearLoadedStatus(yearCacheKey);

      if (!yearLoaded) {
        this.logger.log(`Preloading yearly data for ${coinId}`);
        await this.preloadPrices(provider, coinId);
        await this.setYearLoadedStatus(yearCacheKey);
      }

      // Find the earliest available price in our cache
      const earliestPrice = await this.findEarliestAvailablePrice(coinId);

      if (earliestPrice) {
        return { price: earliestPrice.price, source: `${providerName}_fallback` };
      } else {
        // If no cached price found, fetch the oldest available from provider
        if (provider instanceof CoinGeckoProviderService) {
          try {
            const fallbackPrice = await provider.fetchOldestAvailablePrice(coinId);
            if (fallbackPrice > 0) {
              this.logger.debug(`Provider fallback price for ${coinId}: ${fallbackPrice}`);
              return { price: fallbackPrice, source: `${providerName}_fallback` };
            }
          } catch (error) {
            this.logger.warn(`Provider fallback failed for ${coinId}: ${error.message}`);
          }
        }
      }
    } else {
      // For recent dates (within 1 year), try to get exact price
      // First ensure yearly data is loaded
      const yearCacheKey = `year_loaded:${coinId}`;
      const yearLoaded = await this.getYearLoadedStatus(yearCacheKey);

      if (!yearLoaded) {
        this.logger.log(`Preloading yearly data for ${coinId}`);
        await this.preloadPrices(provider, coinId);
        await this.setYearLoadedStatus(yearCacheKey);
      }

      // Check if exact date is in cache
      const exactCached = await this.getFromCache(coinId, date);
      if (exactCached) {
        return { price: exactCached.price, source: exactCached.source };
      }

      // Try to fetch exact date from provider
      try {
        const exactPrice = await provider.getHistoricalPrice(coinId, date);
        if (exactPrice > 0) {
          return { price: exactPrice, source: providerName };
        }
      } catch (error) {
        this.logger.warn(`Direct API call failed for ${coinId} on ${dateString}: ${error.message}`);
      }

      // Find nearest available price
      const nearestPrice = await this.findNearestPrice(coinId, date);
      if (nearestPrice) {
        return { price: nearestPrice.price, source: `${providerName}_fallback` };
      }
    }

    return null;
  }

  private async preloadPrices(provider: PriceProviderInterface, coinId: string): Promise<void> {
    try {
      const prices = await provider.preloadPrices(coinId);

      if (!Array.isArray(prices) || prices.length === 0) {
        this.logger.warn(`No price data returned for ${coinId}`);
        return;
      }

      let earliestDate: string | null = null;
      let latestDate: string | null = null;

      const pipeline = this.redisClient?.pipeline();

      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp);
        date.setUTCHours(0, 0, 0, 0);

        const dateStr = date.toISOString().slice(0, 10);

        if (!earliestDate || dateStr < earliestDate) {
          earliestDate = dateStr;
        }
        if (!latestDate || dateStr > latestDate) {
          latestDate = dateStr;
        }

        const key = `price:${coinId}:${dateStr}`;
        const cacheData: CachedPrice = {
          price,
          source: provider.getProviderName(),
          timestamp: Date.now(),
        };
        const ttl = this.getPriceTTL(provider.getProviderName(), date);

        if (pipeline) {
          pipeline.setex(key, ttl, JSON.stringify(cacheData));
        } else {
          await this.setToCache(coinId, date, price, provider.getProviderName());
        }
      }

      if (pipeline) {
        await pipeline.exec();
      }

      // Store metadata
      if (earliestDate && latestDate) {
        await this.setMetadata(coinId, { earliestDate, latestDate });
        this.logger.log(
          `Preloaded ${prices.length} daily prices for ${coinId} (${earliestDate} to ${latestDate})`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to preload yearly prices for ${coinId}: ${error.message}`);
    }
  }

  private async findEarliestAvailablePrice(coinId: string): Promise<CachedPrice | null> {
    try {
      // First check metadata
      const metadata = await this.getMetadata(coinId);
      if (metadata?.earliestDate) {
        const earliestDate = new Date(metadata.earliestDate);
        const cached = await this.getFromCache(coinId, earliestDate);
        if (cached) {
          this.logger.debug(
            `Found earliest price from metadata for ${coinId}: ${metadata.earliestDate} = ${cached.price}`,
          );
          return cached;
        }
      }

      // Use SCAN to find earliest cached price
      if (this.redisClient) {
        const pattern = `price:${coinId}:*`;
        const stream = this.redisClient.scanStream({
          match: pattern,
          count: 100,
        });

        const dateKeys: { key: string; date: string }[] = [];

        await new Promise((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            for (const key of keys) {
              const parts = key.split(':');
              const datePart = parts[parts.length - 1];
              if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                dateKeys.push({ key, date: datePart });
              }
            }
          });

          stream.on('end', resolve);
          stream.on('error', reject);
        });

        if (dateKeys.length > 0) {
          // Sort to find earliest
          dateKeys.sort((a, b) => a.date.localeCompare(b.date));

          const earliestKey = dateKeys[0].key;
          const cached = await this.redisClient.get(earliestKey);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            this.logger.debug(
              `Found earliest cached price for ${coinId}: ${dateKeys[0].date} = ${parsedCache.price}`,
            );
            return parsedCache;
          }
        }
      }

      // Fallback: Check the date from 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      oneYearAgo.setUTCHours(0, 0, 0, 0);

      const yearOldPrice = await this.getFromCache(coinId, oneYearAgo);
      if (yearOldPrice) {
        return yearOldPrice;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error finding earliest available price for ${coinId}: ${error.message}`);
      return null;
    }
  }

  private async findNearestPrice(
    symbol: string,
    targetDate: Date,
    maxDaysForward: number = 30,
  ): Promise<CachedPrice | null> {
    try {
      // Check forward in time first (more likely to have recent data)
      for (let i = 1; i <= maxDaysForward; i++) {
        const nextDate = new Date(targetDate);
        nextDate.setUTCDate(nextDate.getUTCDate() + i);

        const cached = await this.getFromCache(symbol, nextDate);
        if (cached) {
          this.logger.debug(
            `Found nearest price for ${symbol}: ${i} days forward from ${targetDate.toISOString().slice(0, 10)}`,
          );
          return cached;
        }
      }

      // Check backward in time
      for (let i = 1; i <= 7; i++) {
        const prevDate = new Date(targetDate);
        prevDate.setUTCDate(prevDate.getUTCDate() - i);

        const cached = await this.getFromCache(symbol, prevDate);
        if (cached) {
          this.logger.debug(
            `Found nearest price for ${symbol}: ${i} days backward from ${targetDate.toISOString().slice(0, 10)}`,
          );
          return cached;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error finding nearest price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  // Helper methods
  private async getFromCache(symbol: string, date: Date): Promise<CachedPrice | null> {
    try {
      const dateKey = date.toISOString().slice(0, 10);

      // Try direct symbol cache first
      const symbolKey = `price:${symbol}:${dateKey}`;
      let cached = await this.getCacheValue(symbolKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Try to find using provider mapping
      for (const provider of this.providers.values()) {
        const coinId = this.getCoinIdFromProvider(provider, symbol);
        if (coinId) {
          const coinIdKey = `price:${coinId}:${dateKey}`;
          cached = await this.getCacheValue(coinIdKey);

          if (cached) {
            return JSON.parse(cached);
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getCacheValue(key: string): Promise<string | null> {
    try {
      if (this.redisClient) {
        return await this.redisClient.get(key);
      }
      return await this.cacheManager.get<string>(key);
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  private async setToCache(
    symbol: string,
    date: Date,
    price: number,
    source: string,
    customTTL?: number,
  ): Promise<void> {
    try {
      const key = `price:${symbol}:${date.toISOString().slice(0, 10)}`;
      const cacheData: CachedPrice = { price, source, timestamp: Date.now() };
      const ttl = customTTL || this.getPriceTTL(source, date);

      await this.setCacheValue(key, JSON.stringify(cacheData), ttl);
    } catch (error) {
      this.logger.warn(`Cache SET error: ${error.message}`);
    }
  }

  private async setCacheValue(key: string, value: string, ttl: number): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.setex(key, ttl, value);
      } else {
        await this.cacheManager.set(key, value, ttl * SEC_IN_MS);
      }
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}: ${error.message}`);
    }
  }

  private async setMetadata(
    coinId: string,
    metadata: { earliestDate?: string; latestDate?: string },
  ): Promise<void> {
    try {
      const key = `price_metadata:${coinId}`;
      const ttl = 7 * DAY_IN_SEC;
      await this.setCacheValue(key, JSON.stringify(metadata), ttl);
    } catch (error) {
      this.logger.warn(`Failed to set metadata for ${coinId}: ${error.message}`);
    }
  }

  private async getMetadata(
    coinId: string,
  ): Promise<{ earliestDate?: string; latestDate?: string } | null> {
    try {
      const key = `price_metadata:${coinId}`;
      const cached = await this.getCacheValue(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  private async getYearLoadedStatus(key: string): Promise<boolean> {
    try {
      const cached = await this.getCacheValue(key);
      return cached === 'true';
    } catch (error) {
      return false;
    }
  }

  private async setYearLoadedStatus(key: string): Promise<void> {
    try {
      const ttl = DAY_IN_SEC; // 24 hours
      await this.setCacheValue(key, 'true', ttl);
    } catch (error) {
      this.logger.warn(`Failed to set year loaded status: ${error.message}`);
    }
  }

  private getPriceTTL(source: string, date: Date): number {
    const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);

    if (source === 'hardcoded') return 7 * DAY_IN_SEC;
    if (source.includes('coingecko') && !source.includes('fallback'))
      return daysDiff > 30 ? 7 * DAY_IN_SEC : DAY_IN_SEC;
    if (source.includes('fallback')) return daysDiff > 7 ? 3 * DAY_IN_SEC : 12 * HOUR_IN_SEC;

    return DAY_IN_SEC;
  }

  async clearCache(): Promise<number> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available for cache clearing');
      return 0;
    }

    const pattern = 'price:*';

    try {
      const stream = this.redisClient.scanStream({
        match: pattern,
        count: 100,
      });

      let deletedCount = 0;
      const pipeline = this.redisClient.pipeline();

      await new Promise((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          if (keys.length > 0) {
            keys.forEach((key) => pipeline.del(key));
            deletedCount += keys.length;
          }
        });

        stream.on('end', async () => {
          if (deletedCount > 0) {
            await pipeline.exec();
          }
          resolve(deletedCount);
        });

        stream.on('error', reject);
      });

      this.logger.log(`Cleared ${deletedCount} cache entries`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
      return 0;
    }
  }
}
