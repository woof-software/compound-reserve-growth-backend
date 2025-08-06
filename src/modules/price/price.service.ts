import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';

import { PriceProviderInterface } from './interfaces/price-provider.interface';
import { CachedPrice } from './interfaces/cached-price.interface';
import { CoinGeckoProviderService } from './providers/coingecko/coingecko.service';
import { STABLECOIN_PRICES } from './constants';
import { Price } from './price.entity';
import { PriceRepository } from './price.repository';

import { DAY_IN_MS, DAY_IN_SEC, HOUR_IN_SEC, SEC_IN_MS } from '@app/common/constants';

@Injectable()
export class PriceService implements OnModuleInit {
  private readonly logger = new Logger(PriceService.name);
  private readonly providers: Map<string, PriceProviderInterface> = new Map();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly coinGeckoProvider: CoinGeckoProviderService,
    private readonly priceRepository: PriceRepository,
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

    // Check database
    const dbPrice = await this.getFromDatabase(asset.symbol, date);
    if (dbPrice) {
      this.logger.debug(
        `Price DB HIT: ${asset.symbol} @ ${date.toISOString().slice(0, 10)} = ${dbPrice.price}`,
      );
      // Cache the DB result for faster future access
      await this.setToCache(asset.symbol, date, dbPrice.price, 'database');
      return dbPrice.price;
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

      // Save to database if it came from an external provider
      if (source !== 'hardcoded' && source !== 'database') {
        await this.saveToDatabase(asset.symbol, price, date);
      }

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

        const result = await this.getExactOrNearestPrice(provider, coinId, asset.symbol, date);
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
    symbol: string,
    date: Date,
  ): Promise<{ price: number; source: string } | null> {
    const providerName = provider.getProviderName();
    const dateString = date.toISOString().slice(0, 10);

    // Calculate time periods
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const isOlderThanFiveYears = date < fiveYearsAgo;

    // Check if we need to preload historical data
    const preloadKey = `preload_status:${coinId}`;
    const preloadStatus = await this.getPreloadStatus(preloadKey);

    if (!preloadStatus.loaded) {
      this.logger.log(`Preloading historical data for ${coinId} from ${providerName}`);
      await this.preloadHistoricalPrices(provider, coinId, symbol);
      await this.setPreloadStatus(preloadKey, true);
    }

    // Check database first for historical prices
    const dbPrice = await this.getFromDatabase(symbol, date);
    if (dbPrice) {
      return { price: dbPrice.price, source: 'database' };
    }

    if (isOlderThanFiveYears && provider instanceof CoinGeckoProviderService) {
      // For dates older than 5 years, use the earliest available price
      this.logger.debug(
        `Date ${dateString} is older than 5 years, looking for earliest available price`,
      );

      const earliestPrice = await this.findEarliestDatabasePrice(symbol);
      if (earliestPrice) {
        return { price: earliestPrice.price, source: 'database_fallback' };
      }

      // Try provider fallback
      try {
        const fallbackPrice = await provider.fetchOldestAvailablePrice(coinId);
        if (fallbackPrice > 0) {
          await this.saveToDatabase(symbol, fallbackPrice, date);
          return { price: fallbackPrice, source: `${providerName}_fallback` };
        }
      } catch (error) {
        this.logger.warn(`Provider fallback failed for ${coinId}: ${error.message}`);
      }
    } else {
      // For recent dates, try to get exact price from provider
      try {
        const exactPrice = await provider.getHistoricalPrice(coinId, date);
        if (exactPrice > 0) {
          await this.saveToDatabase(symbol, exactPrice, date);
          return { price: exactPrice, source: providerName };
        }
      } catch (error) {
        this.logger.warn(`Direct API call failed for ${coinId} on ${dateString}: ${error.message}`);
      }

      // Find nearest available price in database
      const nearestPrice = await this.findNearestDatabasePrice(symbol, date);
      if (nearestPrice) {
        return { price: nearestPrice.price, source: 'database_nearest' };
      }

      // Find nearest cached price as fallback
      const nearestCachedPrice = await this.findNearestPrice(coinId, date);
      if (nearestCachedPrice) {
        return { price: nearestCachedPrice.price, source: `${providerName}_fallback` };
      }
    }

    return null;
  }

  private async preloadHistoricalPrices(
    provider: PriceProviderInterface,
    coinId: string,
    symbol: string,
  ): Promise<void> {
    try {
      if (!(provider instanceof CoinGeckoProviderService)) {
        this.logger.warn(`Preloading not supported for provider: ${provider.getProviderName()}`);
        return;
      }

      const apiType = provider.getApiType();
      const maxDaysBack = apiType === 'pro' ? 6 * 365 : 365; // 6 years for pro, 1 year for demo/free

      this.logger.log(
        `Preloading ${maxDaysBack} days of data for ${coinId} (API type: ${apiType})`,
      );

      const prices = await provider.preloadPrices(coinId);

      if (!Array.isArray(prices) || prices.length === 0) {
        this.logger.warn(`No price data returned for ${coinId}`);
        return;
      }

      // Check which dates we already have in the database to avoid duplicates
      const existingPrices = await this.priceRepository.findBySymbol(symbol);
      const existingDates = new Set(existingPrices.map((p) => p.date.toISOString().slice(0, 10)));

      const priceBatch: Price[] = [];
      let earliestDate: string | null = null;
      let latestDate: string | null = null;

      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp);
        date.setUTCHours(0, 0, 0, 0);
        const dateStr = date.toISOString().slice(0, 10);

        // Skip if we already have this date
        if (existingDates.has(dateStr)) {
          continue;
        }

        if (!earliestDate || dateStr < earliestDate) {
          earliestDate = dateStr;
        }
        if (!latestDate || dateStr > latestDate) {
          latestDate = dateStr;
        }

        const priceEntity = new Price(symbol, price, date);
        priceBatch.push(priceEntity);
      }

      // Save in batches for better performance
      if (priceBatch.length > 0) {
        const batchSize = 100;
        let savedCount = 0;

        for (let i = 0; i < priceBatch.length; i += batchSize) {
          const batch = priceBatch.slice(i, i + batchSize);
          await this.saveBatchToDatabase(batch);
          savedCount += batch.length;

          // Small delay between batches to avoid overwhelming the database
          if (i + batchSize < priceBatch.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        this.logger.log(`Preloaded and saved ${savedCount} new price records for ${symbol}`);

        if (earliestDate && latestDate) {
          this.logger.log(`Date range: ${earliestDate} to ${latestDate}`);
        }
      } else {
        this.logger.log(`All price data for ${symbol} already exists in database`);
      }
    } catch (error) {
      this.logger.warn(`Failed to preload historical prices for ${coinId}: ${error.message}`);
    }
  }

  // Database operations
  private async getFromDatabase(symbol: string, date: Date): Promise<Price | null> {
    try {
      // Normalize date to start of day for consistent querying
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      return await this.priceRepository.findBySymbolAndDate(symbol, normalizedDate);
    } catch (error) {
      this.logger.error(`Database query error for ${symbol}: ${error.message}`);
      return null;
    }
  }

  private async saveToDatabase(symbol: string, price: number, date: Date): Promise<void> {
    try {
      // Normalize date to start of day for consistency
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      const priceEntity = new Price(symbol, price, normalizedDate);
      await this.priceRepository.saveToDatabase(priceEntity);
      this.logger.debug(
        `Saved price to DB: ${symbol} @ ${normalizedDate.toISOString().slice(0, 10)} = ${price}`,
      );
    } catch (error) {
      this.logger.error(`Failed to save price to database: ${error.message}`);
    }
  }

  private async saveBatchToDatabase(prices: Price[]): Promise<void> {
    try {
      if (prices.length === 0) return;

      // Normalize all dates to start of day
      const normalizedPrices = prices.map((price) => {
        const normalizedDate = new Date(price.date);
        normalizedDate.setUTCHours(0, 0, 0, 0);
        return new Price(price.symbol, price.price, normalizedDate);
      });

      await this.priceRepository.saveBatch(normalizedPrices);
      this.logger.debug(`Batch saved ${prices.length} prices to database`);
    } catch (error) {
      this.logger.error(`Failed to save price batch to database: ${error.message}`);
    }
  }

  private async findEarliestDatabasePrice(symbol: string): Promise<Price | null> {
    try {
      return await this.priceRepository.findEarliestBySymbol(symbol);
    } catch (error) {
      this.logger.error(`Error finding earliest DB price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  private async findNearestDatabasePrice(symbol: string, targetDate: Date): Promise<Price | null> {
    try {
      return await this.priceRepository.findNearestBySymbolAndDate(symbol, targetDate, 30);
    } catch (error) {
      this.logger.error(`Error finding nearest DB price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  // Preload status management
  private async getPreloadStatus(key: string): Promise<{ loaded: boolean }> {
    try {
      const cached = await this.getCacheValue(key);
      return { loaded: cached === 'true' };
    } catch (error) {
      return { loaded: false };
    }
  }

  private async setPreloadStatus(key: string, loaded: boolean): Promise<void> {
    try {
      const ttl = 7 * DAY_IN_SEC; // Cache for 7 days
      await this.setCacheValue(key, loaded.toString(), ttl);
    } catch (error) {
      this.logger.warn(`Failed to set preload status: ${error.message}`);
    }
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

  // Helper methods (keeping existing cache methods unchanged)
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

  private getPriceTTL(source: string, date: Date): number {
    const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);

    if (source === 'hardcoded') return 7 * DAY_IN_SEC;
    if (source === 'database') return 7 * DAY_IN_SEC; // Database prices can be cached longer
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

  /**
   * Get database statistics for monitoring and debugging
   */
  async getDatabaseStats(): Promise<{
    availableSymbols: string[];
    symbolStats: { symbol: string; count: number; earliest: Date; latest: Date }[];
    totalPrices: number;
  }> {
    try {
      const symbols = await this.priceRepository.getAvailableSymbols();
      const symbolStats = [];
      let totalPrices = 0;

      for (const symbol of symbols) {
        const count = await this.priceRepository.countBySymbol(symbol);
        const dateRange = await this.priceRepository.getDateRangeForSymbol(symbol);

        totalPrices += count;

        if (dateRange) {
          symbolStats.push({
            symbol,
            count,
            earliest: dateRange.earliest,
            latest: dateRange.latest,
          });
        }
      }

      return {
        availableSymbols: symbols,
        symbolStats,
        totalPrices,
      };
    } catch (error) {
      this.logger.error(`Error getting database stats: ${error.message}`);
      return {
        availableSymbols: [],
        symbolStats: [],
        totalPrices: 0,
      };
    }
  }

  /**
   * Force refresh of historical data for a specific symbol
   */
  async refreshHistoricalData(symbol: string): Promise<boolean> {
    try {
      // Find the provider and coinId for this symbol
      let coinId: string | null = null;
      let provider: PriceProviderInterface | null = null;

      for (const [, prov] of this.providers) {
        const mappings = prov.getMappings();
        if (mappings[symbol]) {
          coinId = mappings[symbol];
          provider = prov;
          break;
        }
      }

      if (!coinId || !provider) {
        this.logger.warn(`No provider mapping found for symbol: ${symbol}`);
        return false;
      }

      this.logger.log(`Force refreshing historical data for ${symbol} (${coinId})`);

      // Clear existing preload status to force reload
      const preloadKey = `preload_status:${coinId}`;
      if (this.redisClient) {
        await this.redisClient.del(preloadKey);
      }

      // Trigger preload
      await this.preloadHistoricalPrices(provider, coinId, symbol);

      return true;
    } catch (error) {
      this.logger.error(`Error refreshing historical data for ${symbol}: ${error.message}`);
      return false;
    }
  }

  async forceReloadAllHistoricalData(): Promise<void> {
    this.logger.log('Starting force reload of all historical data...');

    try {
      // Clear all preload status flags
      await this.clearAllPreloadFlags();

      // Get all symbols that have mappings
      const allSymbols = new Set<string>();

      for (const provider of this.providers.values()) {
        const mappings = provider.getMappings();
        Object.keys(mappings).forEach((symbol) => allSymbols.add(symbol));
      }

      this.logger.log(`Found ${allSymbols.size} symbols to reload`);

      // Reload each symbol
      let completed = 0;
      for (const symbol of allSymbols) {
        try {
          await this.forceReloadSymbol(symbol);
          completed++;
          this.logger.log(`Reloaded ${symbol} (${completed}/${allSymbols.size})`);

          // Small delay to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.warn(`Failed to reload ${symbol}: ${error.message}`);
        }
      }

      this.logger.log(
        `Force reload completed. Successfully reloaded ${completed}/${allSymbols.size} symbols`,
      );
    } catch (error) {
      this.logger.error(`Force reload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Force reload historical data for a specific symbol, clearing cache first
   */
  async forceReloadSymbol(symbol: string): Promise<boolean> {
    try {
      // Find the provider and coinId for this symbol
      let coinId: string | null = null;
      let provider: PriceProviderInterface | null = null;

      for (const [, prov] of this.providers) {
        const mappings = prov.getMappings();
        if (mappings[symbol]) {
          coinId = mappings[symbol];
          provider = prov;
          break;
        }
      }

      if (!coinId || !provider) {
        this.logger.warn(`No provider mapping found for symbol: ${symbol}`);
        return false;
      }

      this.logger.log(`Force reloading ${symbol} (${coinId}) with current API settings`);

      // Clear cache entries for this symbol/coinId
      await this.clearCacheForSymbol(symbol, coinId);

      // Clear preload status to force reload
      const preloadKey = `preload_status:${coinId}`;
      if (this.redisClient) {
        await this.redisClient.del(preloadKey);
      }

      // Force preload with current API settings
      await this.preloadHistoricalPrices(provider, coinId, symbol);

      return true;
    } catch (error) {
      this.logger.error(`Error force reloading ${symbol}: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear cache entries for a specific symbol
   */
  private async clearCacheForSymbol(symbol: string, coinId: string): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available for cache clearing');
      return;
    }

    try {
      // Clear cache entries for both symbol and coinId
      const patterns = [
        `price:${symbol}:*`,
        `price:${coinId}:*`,
        `price_metadata:${coinId}`,
        `preload_status:${coinId}`,
        `year_loaded:${coinId}`,
      ];

      let deletedCount = 0;

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          // Use SCAN for patterns with wildcards
          const stream = this.redisClient.scanStream({
            match: pattern,
            count: 100,
          });

          const keysToDelete: string[] = [];

          await new Promise((resolve, reject) => {
            stream.on('data', (keys: string[]) => {
              keysToDelete.push(...keys);
            });

            stream.on('end', resolve);
            stream.on('error', reject);
          });

          if (keysToDelete.length > 0) {
            await this.redisClient.del(...keysToDelete);
            deletedCount += keysToDelete.length;
          }
        } else {
          // Direct key deletion
          const result = await this.redisClient.del(pattern);
          deletedCount += result;
        }
      }

      this.logger.log(`Cleared ${deletedCount} cache entries for ${symbol}/${coinId}`);
    } catch (error) {
      this.logger.error(`Error clearing cache for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Clear all preload status flags to force fresh data loading
   */
  private async clearAllPreloadFlags(): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available');
      return;
    }

    try {
      const patterns = ['preload_status:*', 'year_loaded:*'];

      let deletedCount = 0;

      for (const pattern of patterns) {
        const stream = this.redisClient.scanStream({
          match: pattern,
          count: 100,
        });

        const keysToDelete: string[] = [];

        await new Promise((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            keysToDelete.push(...keys);
          });

          stream.on('end', resolve);
          stream.on('error', reject);
        });

        if (keysToDelete.length > 0) {
          await this.redisClient.del(...keysToDelete);
          deletedCount += keysToDelete.length;
        }
      }

      this.logger.log(`Cleared ${deletedCount} preload status flags`);
    } catch (error) {
      this.logger.error(`Error clearing preload flags: ${error.message}`);
    }
  }

  /**
   * Get reload progress for monitoring
   */
  async getReloadProgress(): Promise<{
    totalSymbols: number;
    symbolsInDb: number;
    symbolsWithFullHistory: { [symbol: string]: { count: number; dateRange: string } };
  }> {
    try {
      // Get all possible symbols from mappings
      const allSymbols = new Set<string>();
      for (const provider of this.providers.values()) {
        const mappings = provider.getMappings();
        Object.keys(mappings).forEach((symbol) => allSymbols.add(symbol));
      }

      // Check which symbols have data in DB
      const dbStats = await this.getDatabaseStats();
      const symbolsWithFullHistory: { [symbol: string]: { count: number; dateRange: string } } = {};

      for (const stat of dbStats.symbolStats) {
        const daysDiff = Math.floor(
          (stat.latest.getTime() - stat.earliest.getTime()) / (1000 * 60 * 60 * 24),
        );
        symbolsWithFullHistory[stat.symbol] = {
          count: stat.count,
          dateRange: `${stat.earliest.toISOString().slice(0, 10)} to ${stat.latest.toISOString().slice(0, 10)} (${daysDiff} days)`,
        };
      }

      return {
        totalSymbols: allSymbols.size,
        symbolsInDb: dbStats.availableSymbols.length,
        symbolsWithFullHistory,
      };
    } catch (error) {
      this.logger.error(`Error getting reload progress: ${error.message}`);
      return {
        totalSymbols: 0,
        symbolsInDb: 0,
        symbolsWithFullHistory: {},
      };
    }
  }
}
