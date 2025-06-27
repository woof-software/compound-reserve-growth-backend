import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';

import { COINGECKO_MAPPINGS, STABLECOIN_PRICES } from './constants';

import { DAY_IN_MS, DAY_IN_SEC, HOUR_IN_SEC, SEC_IN_MS } from '@app/common/constants';

interface CachedPrice {
  price: number;
  source: 'coingecko' | 'coingecko_fallback' | 'hardcoded';
  timestamp: number;
}

@Injectable()
export class PriceService implements OnModuleInit {
  private readonly logger = new Logger(PriceService.name);
  private lastCoingeckoRequest = 0;
  private coingeckoDelay: number;
  private readonly coingeckoApiKey: string;
  private readonly coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    this.coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY', '');

    if (this.coingeckoApiKey) {
      this.logger.log('CoinGecko Pro API key configured');
      this.coingeckoDelay = 500; // Pro tier
    } else {
      this.logger.warn('No CoinGecko API key found, using free tier');
      this.coingeckoDelay = 1200; // Free tier
    }
  }

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

  async getHistoricalPrice(
    asset: { address: string; symbol: string; decimals: number },
    network: string,
    date: Date,
  ): Promise<number> {
    // Check cache first
    const cachedPrice = await this.getFromCache(network, asset.symbol, date);
    if (cachedPrice) {
      this.logger.debug(
        `Price cache HIT: ${asset.symbol} @ ${date.toISOString().slice(0, 10)} = $${cachedPrice.price}`,
      );
      return cachedPrice.price;
    }

    let price = 1;
    let source: CachedPrice['source'] = 'hardcoded';

    try {
      // Check if stablecoin
      if (STABLECOIN_PRICES[asset.symbol]) {
        price = STABLECOIN_PRICES[asset.symbol];
        source = 'hardcoded';
      } else {
        // Try CoinGecko
        const coinId = COINGECKO_MAPPINGS[network]?.[asset.symbol];
        if (coinId) {
          // Calculate if the requested date is older than 1 year
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const isOlderThanOneYear = date < oneYearAgo;

          if (isOlderThanOneYear) {
            // For dates older than 1 year, use the earliest available price from the last year
            this.logger.debug(
              `Date ${date.toISOString().slice(0, 10)} is older than 1 year, looking for earliest available price`,
            );

            // First ensure we have the yearly data loaded
            const yearCacheKey = `year_loaded:${coinId}`;
            const yearLoaded = await this.getYearLoadedStatus(yearCacheKey);

            if (!yearLoaded) {
              this.logger.log(`Preloading yearly data for ${asset.symbol} (${coinId})`);
              await this.preloadYearlyPrices(coinId);
              await this.setYearLoadedStatus(yearCacheKey);
            }

            // Find the earliest available price in our cache
            const earliestPrice = await this.findEarliestAvailablePrice(coinId);

            if (earliestPrice) {
              price = earliestPrice.price;
              source = 'coingecko_fallback';
              this.logger.debug(`Using earliest available price for ${asset.symbol}: $${price}`);
            } else {
              // If no cached price found, fetch the oldest available from API
              const fallbackPrice = await this.fetchOldestAvailablePrice(coinId);
              if (fallbackPrice > 0) {
                price = fallbackPrice;
                source = 'coingecko_fallback';
              }
            }
          } else {
            // For recent dates (within 1 year), try to get exact price
            const exactPrice = await this.getExactOrNearestPrice(coinId, date);
            if (exactPrice) {
              price = exactPrice.price;
              source = exactPrice.source;
            }
          }
        }
      }

      // Handle special cases ONLY if no price was found
      if (price <= 1 && !STABLECOIN_PRICES[asset.symbol]) {
        price = this.handleSpecialCases(asset, price);
      }

      // Cache the result
      await this.setToCache(network, asset.symbol, date, price, source);
    } catch (error) {
      this.logger.error(`Error getting price for ${asset.symbol}:`, error);
      await this.setToCache(network, asset.symbol, date, price, 'hardcoded', 3600);
    }

    return price;
  }

  private async getExactOrNearestPrice(
    coinId: string,
    date: Date,
  ): Promise<{ price: number; source: CachedPrice['source'] } | null> {
    // First ensure yearly data is loaded
    const yearCacheKey = `year_loaded:${coinId}`;
    const yearLoaded = await this.getYearLoadedStatus(yearCacheKey);

    if (!yearLoaded) {
      this.logger.log(`Preloading yearly data for ${coinId}`);
      await this.preloadYearlyPrices(coinId);
      await this.setYearLoadedStatus(yearCacheKey);
    }

    // Check if exact date is in cache
    const exactCached = await this.getFromCache('all', coinId, date);
    if (exactCached) {
      return { price: exactCached.price, source: exactCached.source };
    }

    // Try to fetch exact date from API
    try {
      const exactPrice = await this.getCoinGeckoHistoricalPrice(coinId, date);
      if (exactPrice > 0) {
        return { price: exactPrice, source: 'coingecko' };
      }
    } catch (error) {
      this.logger.debug(
        `Could not fetch exact price for ${coinId} on ${date.toISOString().slice(0, 10)}: ${error.message}`,
      );
    }

    // Find nearest available price
    const nearestPrice = await this.findNearestPrice('all', coinId, date);
    if (nearestPrice) {
      return { price: nearestPrice.price, source: 'coingecko_fallback' };
    }

    return null;
  }

  private async findEarliestAvailablePrice(coinId: string): Promise<CachedPrice | null> {
    try {
      // First check metadata
      const metadata = await this.getMetadata(coinId);
      if (metadata?.earliestDate) {
        const earliestDate = new Date(metadata.earliestDate);
        const cached = await this.getFromCache('all', coinId, earliestDate);
        if (cached) {
          this.logger.debug(
            `Found earliest price from metadata for ${coinId}: ${metadata.earliestDate} = ${cached.price}`,
          );
          return cached;
        }
      }

      // Use SCAN to find earliest cached price
      if (this.redisClient) {
        const pattern = `price:all:${coinId}:*`;
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

      const yearOldPrice = await this.getFromCache('all', coinId, oneYearAgo);
      if (yearOldPrice) {
        return yearOldPrice;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error finding earliest available price for ${coinId}: ${error.message}`);
      return null;
    }
  }

  private async fetchOldestAvailablePrice(coinId: string): Promise<number> {
    try {
      await this.rateLimitDelay();

      // Get price from exactly 365 days ago (maximum for free tier)
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);

      const dateString = oneYearAgo.toISOString().split('T')[0];
      const url = `${this.coingeckoBaseUrl}/coins/${coinId}/history?date=${dateString}`;

      const response = await fetch(url, this.getCoingeckoOptions());
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const price = data.market_data?.current_price?.usd || 0;

      if (price > 0) {
        // Cache this price
        await this.setToCache('all', coinId, oneYearAgo, price, 'coingecko');
        this.logger.debug(
          `Fetched oldest available price for ${coinId}: ${dateString} = $${price}`,
        );
      }

      return price;
    } catch (error) {
      this.logger.warn(`Failed to fetch oldest available price for ${coinId}: ${error.message}`);
      return 0;
    }
  }

  private async preloadYearlyPrices(coinId: string): Promise<void> {
    await this.rateLimitDelay();

    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);

    // For free tier, we can only get last 365 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    startDate.setUTCHours(0, 0, 0, 0);

    const fromTimestamp = Math.floor(startDate.getTime() / 1000);
    const toTimestamp = Math.floor(endDate.getTime() / 1000);

    const url = `${this.coingeckoBaseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;

    try {
      const response = await fetch(url, this.getCoingeckoOptions());
      if (!response.ok) {
        throw new Error(`CoinGecko range API error: ${response.status}`);
      }

      const data = await response.json();
      const prices = data.prices || [];

      if (prices.length === 0) {
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

        const key = `price:all:${coinId}:${dateStr}`;
        const cacheData: CachedPrice = {
          price,
          source: 'coingecko',
          timestamp: Date.now(),
        };
        const ttl = this.getPriceTTL('coingecko', date);

        if (pipeline) {
          pipeline.setex(key, ttl, JSON.stringify(cacheData));
        } else {
          await this.setToCache('all', coinId, date, price, 'coingecko');
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

  private async findNearestPrice(
    network: string,
    symbol: string,
    targetDate: Date,
    maxDaysForward: number = 30,
  ): Promise<CachedPrice | null> {
    try {
      // Check forward in time first (more likely to have recent data)
      for (let i = 1; i <= maxDaysForward; i++) {
        const nextDate = new Date(targetDate);
        nextDate.setUTCDate(nextDate.getUTCDate() + i);

        const cached = await this.getFromCache(network, symbol, nextDate);
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

        const cached = await this.getFromCache(network, symbol, prevDate);
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

  // Helper methods remain the same
  private async getFromCache(
    network: string,
    symbol: string,
    date: Date,
  ): Promise<CachedPrice | null> {
    try {
      const dateKey = date.toISOString().slice(0, 10);
      const networkKey = `price:${network}:${symbol}:${dateKey}`;
      let cached = await this.getCacheValue(networkKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const coinId = COINGECKO_MAPPINGS[network]?.[symbol];
      if (coinId) {
        const globalKey = `price:all:${coinId}:${dateKey}`;
        cached = await this.getCacheValue(globalKey);

        if (cached) {
          return JSON.parse(cached);
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
    network: string,
    symbol: string,
    date: Date,
    price: number,
    source: CachedPrice['source'],
    customTTL?: number,
  ): Promise<void> {
    try {
      const key = `price:${network}:${symbol}:${date.toISOString().slice(0, 10)}`;
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

  private getCoingeckoOptions(): RequestInit {
    const headers: HeadersInit = {
      accept: 'application/json',
    };

    if (this.coingeckoApiKey) {
      headers['x-cg-demo-api-key'] = this.coingeckoApiKey;
    }

    return {
      method: 'GET',
      headers,
    };
  }

  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastCoingeckoRequest;

    if (timeSinceLastRequest < this.coingeckoDelay) {
      const delay = this.coingeckoDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastCoingeckoRequest = Date.now();
  }

  private async getCoinGeckoHistoricalPrice(coinId: string, date: Date): Promise<number> {
    await this.rateLimitDelay();

    const dateString = date.toISOString().split('T')[0];
    const url = `${this.coingeckoBaseUrl}/coins/${coinId}/history?date=${dateString}`;

    const response = await fetch(url, this.getCoingeckoOptions());
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data.market_data?.current_price?.usd || 0;
  }

  private handleSpecialCases(
    asset: { address: string; symbol: string; decimals: number },
    currentPrice: number,
  ): number {
    if ((asset.symbol === 'ETH' || asset.symbol === 'WETH') && currentPrice <= 1) {
      return 2000;
    }
    if (asset.symbol === 'wstETH' && currentPrice <= 1) {
      return 2200;
    }
    if (asset.symbol === 'WBTC' && currentPrice <= 1) {
      return 40000;
    }
    if (currentPrice <= 0) {
      return 1;
    }
    return currentPrice;
  }

  private getPriceTTL(source: CachedPrice['source'], date: Date): number {
    const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);

    if (source === 'hardcoded') return 7 * DAY_IN_SEC;
    if (source === 'coingecko') return daysDiff > 30 ? 7 * DAY_IN_SEC : DAY_IN_SEC;
    if (source === 'coingecko_fallback') return daysDiff > 7 ? 3 * DAY_IN_SEC : 12 * HOUR_IN_SEC;

    return DAY_IN_SEC;
  }

  async clearCache(network?: string): Promise<number> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available for cache clearing');
      return 0;
    }

    const pattern = network ? `price:${network}:*` : 'price:*';

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
