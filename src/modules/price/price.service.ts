import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { COINGECKO_MAPPINGS, STABLECOIN_PRICES } from './constants';

import { DAY_IN_MS, DAY_IN_SEC, HOUR_IN_SEC, SEC_IN_MS, YEAR_IN_DAYS } from '@app/common/constants';

interface CachedPrice {
  price: number;
  source: 'coingecko' | 'coingecko_fallback' | 'hardcoded';
  timestamp: number;
}

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private redisClient: any;
  private lastCoingeckoRequest = 0;
  private coingeckoDelay: number;
  private readonly coingeckoApiKey: string;
  private readonly coingeckoBaseUrl = 'https://api.coingecko.com/api/v3'; // TODO: change to 'https://pro-api.coingecko.com/api/v3'

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: any,
    private readonly configService: ConfigService,
  ) {
    this.coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY', '');
    this.initializeRedis();

    if (this.coingeckoApiKey) {
      this.logger.log('CoinGecko Pro API key configured');
      this.coingeckoDelay = 500; // Pro tier
    } else {
      this.logger.warn('No CoinGecko API key found, using free tier');
      this.coingeckoDelay = 1200; // Free tier
    }
  }

  private initializeRedis(): void {
    try {
      if (this.cacheManager.store?.client) {
        this.redisClient = this.cacheManager.store.client;
        this.logger.log('Redis initialized for price service');
      }
    } catch (error) {
      this.logger.warn(`Redis initialization failed: ${error.message}`);
    }
  }

  private getCoingeckoOptions(): RequestInit {
    const headers: HeadersInit = {
      accept: 'application/json',
    };

    if (this.coingeckoApiKey) {
      //TODO: change to 'x-cg-pro-api-key'
      headers['x-cg-demo-api-key'] = this.coingeckoApiKey;
    }

    return {
      method: 'GET',
      headers,
    };
  }

  private async preloadYearlyPrices(coinId: string): Promise<void> {
    await this.rateLimitDelay();

    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);

    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
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

      // Cache prices by days
      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp);
        // Round to start of UTC day
        date.setUTCHours(0, 0, 0, 0);

        await this.setToCache('all', coinId, date, price, 'coingecko');
      }

      this.logger.log(`Preloaded ${prices.length} daily prices for ${coinId}`);
    } catch (error) {
      this.logger.warn(`Failed to preload yearly prices for ${coinId}: ${error.message}`);
    }
  }

  async getHistoricalPrice(
    asset: { address: string; symbol: string; decimals: number },
    network: string,
    date: Date,
  ): Promise<number> {
    // Check cache
    const cachedPrice = await this.getFromCache(network, asset.symbol, date);
    if (cachedPrice) {
      this.logger.debug(`Price cache HIT: ${asset.symbol} = $${cachedPrice.price}`);
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
          // Check if yearly data is loaded (only for non-stablecoins)
          const yearCacheKey = `year_loaded:${coinId}`;
          const yearLoaded = await this.getYearLoadedStatus(yearCacheKey);

          if (!yearLoaded) {
            this.logger.log(`Preloading yearly data for ${asset.symbol} (${coinId})`);
            await this.preloadYearlyPrices(coinId);
            await this.setYearLoadedStatus(yearCacheKey);
          }

          // Try to get from cache again after preloading
          const cachedAfterPreload = await this.getFromCache('all', coinId, date);
          if (cachedAfterPreload) {
            await this.setToCache(
              network,
              asset.symbol,
              date,
              cachedAfterPreload.price,
              cachedAfterPreload.source,
            );
            return cachedAfterPreload.price;
          }

          // If exact date not found, look for nearest price
          const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);
          let nearestPrice: CachedPrice | null = null;

          if (daysDiff > 365) {
            // For data older than 1 year, find earliest available price
            nearestPrice = await this.findEarliestPrice('all', coinId);
          } else {
            // For data within 1 year, find nearest next price
            nearestPrice = await this.findNearestPrice('all', coinId, date);
          }

          if (nearestPrice) {
            // Copy found price to cache for current date
            await this.setToCache(
              network,
              asset.symbol,
              date,
              nearestPrice.price,
              nearestPrice.source,
            );
            return nearestPrice.price;
          }

          // If still no price found, make regular request
          const result = await this.fetchCoinGeckoPrice(coinId, date);
          price = result.price;
          source = result.source;
        }
      }

      // Handle special cases ONLY if no price was found
      if (price <= 1 && !STABLECOIN_PRICES[asset.symbol]) {
        price = this.handleSpecialCases(asset, price);
      }

      // Cache result
      await this.setToCache(network, asset.symbol, date, price, source);
    } catch (error) {
      this.logger.error(`Error getting price for ${asset.symbol}:`, error);
      await this.setToCache(network, asset.symbol, date, price, 'hardcoded', 3600);
    }

    return price;
  }

  private async getYearLoadedStatus(key: string): Promise<boolean> {
    try {
      let cached: string | null = null;
      if (this.redisClient?.get) {
        cached = await this.redisClient.get(key);
      } else {
        cached = await this.cacheManager.get(key);
      }
      return cached === 'true';
    } catch (error) {
      return false;
    }
  }

  private async setYearLoadedStatus(key: string): Promise<void> {
    try {
      const ttl = 24 * 60 * 60; // 24 часа

      if (this.redisClient?.setEx) {
        await this.redisClient.setEx(key, ttl, 'true');
      } else {
        await this.cacheManager.set(key, 'true', ttl * 1000);
      }
    } catch (error) {
      this.logger.warn(`Failed to set year loaded status: ${error.message}`);
    }
  }

  private async fetchCoinGeckoPrice(
    coinId: string,
    targetDate: Date,
  ): Promise<{ price: number; source: 'coingecko' | 'coingecko_fallback' }> {
    const daysDiff = Math.floor((Date.now() - targetDate.getTime()) / DAY_IN_MS);

    // Try exact price if within last year
    if (daysDiff <= 365) {
      try {
        const exactPrice = await this.getCoinGeckoHistoricalPrice(coinId, targetDate);
        if (exactPrice > 0) {
          return { price: exactPrice, source: 'coingecko' };
        }
      } catch (error) {
        this.logger.warn(`Failed exact price for ${coinId}: ${error.message}`);
      }
    }

    // Fallback to oldest available
    try {
      const fallbackPrice = await this.getCoinGeckoOldestPrice(coinId);
      if (fallbackPrice > 0) {
        return { price: fallbackPrice, source: 'coingecko_fallback' };
      }
    } catch (error) {
      this.logger.warn(`Fallback price failed for ${coinId}: ${error.message}`);
    }

    return { price: 1, source: 'coingecko_fallback' };
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

  private async getCoinGeckoOldestPrice(coinId: string): Promise<number> {
    await this.rateLimitDelay();

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - YEAR_IN_DAYS);
    const timestamp = Math.floor(oneYearAgo.getTime() / SEC_IN_MS);

    const url = `${this.coingeckoBaseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${timestamp}&to=${timestamp + DAY_IN_SEC}`;

    const response = await fetch(url, this.getCoingeckoOptions());
    if (!response.ok) {
      throw new Error(`CoinGecko range API error: ${response.status}`);
    }

    const data = await response.json();
    return data.prices?.[0]?.[1] || 0;
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
    if (this.redisClient?.get) {
      return this.redisClient.get(key);
    } else {
      return this.cacheManager.get(key);
    }
  }

  private async findEarliestPrice(network: string, symbol: string): Promise<CachedPrice | null> {
    try {
      if (!this.redisClient?.scanIterator) {
        this.logger.warn('Redis scan not available, cannot find earliest price');
        return null;
      }

      const pattern = `price:${network}:${symbol}:*`;
      let earliestDate: string | null = null;
      let earliestPrice: CachedPrice | null = null;

      for await (const key of this.redisClient.scanIterator({
        MATCH: pattern,
        COUNT: 1000,
      })) {
        // get date from key: price:network:symbol:YYYY-MM-DD
        const datePart = key.split(':').pop();
        if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (!earliestDate || datePart < earliestDate) {
            const cached = await this.getCacheValue(key);
            if (cached) {
              earliestDate = datePart;
              earliestPrice = JSON.parse(cached);
            }
          }
        }
      }

      if (earliestPrice && earliestDate) {
        this.logger.debug(
          `Found earliest price for ${symbol}: ${earliestDate} = ${earliestPrice.price}`,
        );
        return earliestPrice;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error finding earliest price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  private async findNearestPrice(
    network: string,
    symbol: string,
    targetDate: Date,
    maxDaysForward: number = 30,
  ): Promise<CachedPrice | null> {
    try {
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

      if (this.redisClient?.setEx) {
        await this.redisClient.setEx(key, ttl, JSON.stringify(cacheData));
      } else {
        await this.cacheManager.set(key, JSON.stringify(cacheData), ttl * 1000);
      }
    } catch (error) {
      this.logger.warn(`Cache SET error: ${error.message}`);
    }
  }

  private getPriceTTL(source: CachedPrice['source'], date: Date): number {
    const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);

    if (source === 'hardcoded') return 7 * DAY_IN_SEC;
    if (source === 'coingecko') return daysDiff > 30 ? 7 * DAY_IN_SEC : DAY_IN_SEC;
    if (source === 'coingecko_fallback') return daysDiff > 7 ? 3 * DAY_IN_SEC : 12 * HOUR_IN_SEC;

    return DAY_IN_SEC;
  }

  async clearCache(network?: string): Promise<number> {
    const pattern = network ? `price:${network}:*` : 'price:*';

    if (this.redisClient?.scanIterator && this.redisClient?.del) {
      const keysToDelete: string[] = [];
      for await (const key of this.redisClient.scanIterator({ MATCH: pattern, COUNT: 1000 })) {
        keysToDelete.push(key);
      }

      if (keysToDelete.length > 0) {
        return this.redisClient.del(keysToDelete);
      }
    }

    return 0;
  }
}
