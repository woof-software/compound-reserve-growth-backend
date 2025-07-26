import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PriceProviderInterface } from 'modules/price/interfaces/price-provider.interface';

import { COINGECKO_MAPPINGS } from './coingecko-mappings';

@Injectable()
export class CoinGeckoProviderService implements PriceProviderInterface {
  private readonly logger = new Logger(CoinGeckoProviderService.name);
  private lastCoingeckoRequest = 0;
  private coingeckoDelay: number;
  private readonly coingeckoApiKey: string;
  private readonly coingeckoApiType: string;
  private readonly coingeckoBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY', '');
    this.coingeckoApiType = this.configService.get<string>('COINGECKO_API_TYPE', 'demo');

    if (this.coingeckoApiKey) {
      if (this.coingeckoApiType === 'pro') {
        this.logger.log('CoinGecko Pro API key configured - 5 year history available');
        this.coingeckoDelay = 300; // Pro tier - faster rate limit
        this.coingeckoBaseUrl = 'https://pro-api.coingecko.com/api/v3';
      } else {
        this.logger.log('CoinGecko Demo API key configured - 1 year history available');
        this.coingeckoDelay = 500; // Demo tier
        this.coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';
      }
    } else {
      this.logger.warn('No CoinGecko API key found, using free tier - 1 year history available');
      this.coingeckoDelay = 1200; // Free tier
    }
  }

  getProviderName(): string {
    return 'coingecko';
  }

  getMappings(): Record<string, string> {
    return COINGECKO_MAPPINGS;
  }

  getApiType(): string {
    return this.coingeckoApiType;
  }

  private formatDateForAPI(date: Date): string {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}-${month}-${year}`;
  }

  async getHistoricalPrice(coinId: string, date: Date): Promise<number> {
    await this.rateLimitDelay();

    const formattedDate = this.formatDateForAPI(date);
    const url = `${this.coingeckoBaseUrl}/coins/${coinId}/history?date=${formattedDate}`;

    const response = await fetch(url, this.getCoingeckoOptions());
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data.market_data?.current_price?.usd || 0;
  }

  async preloadPrices(coinId: string): Promise<[number, number][]> {
    await this.rateLimitDelay();

    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);

    // Determine how far back we can go based on API type
    const startDate = new Date();
    const maxDaysBack = this.getMaxHistoryDays();
    startDate.setDate(startDate.getDate() - maxDaysBack);
    startDate.setUTCHours(0, 0, 0, 0);

    this.logger.log(
      `Fetching ${maxDaysBack} days of price data for ${coinId} (API type: ${this.coingeckoApiType})`,
    );

    const fromTimestamp = Math.floor(startDate.getTime() / 1000);
    const toTimestamp = Math.floor(endDate.getTime() / 1000);

    const url = `${this.coingeckoBaseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;

    const response = await fetch(url, this.getCoingeckoOptions());
    if (!response.ok) {
      // If the coin doesn't exist or has limited history, try to get what's available
      if (response.status === 404) {
        this.logger.warn(`Coin ${coinId} not found or has no price history`);
        return [];
      }
      throw new Error(`CoinGecko range API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const prices = data.prices || [];

    if (prices.length === 0) {
      this.logger.warn(`No price data available for ${coinId}`);
      return [];
    }

    // Convert to daily prices (take one price per day, preferably at 00:00 UTC)
    const dailyPrices = this.convertToDailyPrices(prices);

    this.logger.log(
      `Retrieved ${dailyPrices.length} daily prices for ${coinId} from ${this.formatTimestamp(dailyPrices[0]?.[0])} to ${this.formatTimestamp(dailyPrices[dailyPrices.length - 1]?.[0])}`,
    );

    return dailyPrices;
  }

  async fetchOldestAvailablePrice(coinId: string): Promise<number> {
    try {
      await this.rateLimitDelay();

      // Get price from the maximum available period based on API type
      const maxDaysBack = this.getMaxHistoryDays();
      const oldestDate = new Date();
      oldestDate.setDate(oldestDate.getDate() - maxDaysBack);

      const formattedDate = this.formatDateForAPI(oldestDate);
      const url = `${this.coingeckoBaseUrl}/coins/${coinId}/history?date=${formattedDate}`;

      const response = await fetch(url, this.getCoingeckoOptions());
      if (!response.ok) {
        // If exact date fails, try to get the earliest available from market_chart
        return await this.fetchEarliestAvailablePrice(coinId);
      }

      const data = await response.json();
      const price = data.market_data?.current_price?.usd || 0;

      this.logger.debug(
        `Fetched oldest available price for ${coinId}: ${formattedDate} = ${price}`,
      );

      return price;
    } catch (error) {
      this.logger.warn(`Failed to fetch oldest available price for ${coinId}: ${error.message}`);
      return 0;
    }
  }

  private async fetchEarliestAvailablePrice(coinId: string): Promise<number> {
    try {
      await this.rateLimitDelay();

      // Try to get the full available history and take the earliest price
      const maxDaysBack = this.getMaxHistoryDays();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - maxDaysBack);

      const fromTimestamp = Math.floor(startDate.getTime() / 1000);
      const toTimestamp = Math.floor(endDate.getTime() / 1000);

      const url = `${this.coingeckoBaseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;

      const response = await fetch(url, this.getCoingeckoOptions());
      if (!response.ok) {
        throw new Error(`CoinGecko range API error: ${response.status}`);
      }

      const data = await response.json();
      const prices = data.prices || [];

      if (prices.length > 0) {
        // Return the earliest available price
        const earliestPrice = prices[0][1];
        const earliestDate = new Date(prices[0][0]);

        this.logger.debug(
          `Fetched earliest available price for ${coinId}: ${earliestDate.toISOString().slice(0, 10)} = ${earliestPrice}`,
        );

        return earliestPrice;
      }

      return 0;
    } catch (error) {
      this.logger.warn(`Failed to fetch earliest available price for ${coinId}: ${error.message}`);
      return 0;
    }
  }

  getMaxHistoryDays(): number {
    // Pro API can get 6 years of data, demo/free can get 1 year
    return this.coingeckoApiType === 'pro' ? 6 * 365 : 365;
  }

  supportsSymbol(symbol: string): boolean {
    return symbol in COINGECKO_MAPPINGS;
  }

  getRateLimitInfo(): {
    requestsPerMinute: number;
    delayBetweenRequests: number;
    burstLimit?: number;
  } {
    const requestsPerMinute =
      this.coingeckoApiType === 'pro' ? 200 : this.coingeckoApiKey ? 120 : 50;

    return {
      requestsPerMinute,
      delayBetweenRequests: this.coingeckoDelay,
      burstLimit: this.coingeckoApiType === 'pro' ? 50 : 10,
    };
  }

  private convertToDailyPrices(prices: [number, number][]): [number, number][] {
    const dailyPrices: [number, number][] = [];
    const seenDates = new Set<string>();

    for (const [timestamp, price] of prices) {
      const date = new Date(timestamp);
      date.setUTCHours(0, 0, 0, 0);
      const dateKey = date.toISOString().slice(0, 10);

      // Only keep one price per day (the first one we encounter for that date)
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        dailyPrices.push([date.getTime(), price]);
      }
    }

    // Sort by timestamp to ensure chronological order
    return dailyPrices.sort((a, b) => a[0] - b[0]);
  }

  private formatTimestamp(timestamp: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  private getCoingeckoOptions(): RequestInit {
    const headers: HeadersInit = {
      accept: 'application/json',
    };

    if (this.coingeckoApiKey) {
      if (this.coingeckoApiType === 'pro') {
        headers['x-cg-pro-api-key'] = this.coingeckoApiKey;
      } else {
        headers['x-cg-demo-api-key'] = this.coingeckoApiKey;
      }
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
}
