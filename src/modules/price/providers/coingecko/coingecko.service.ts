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
  private readonly coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';

  constructor(private readonly configService: ConfigService) {
    this.coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY', '');

    if (this.coingeckoApiKey) {
      this.logger.log('CoinGecko Pro API key configured');
      this.coingeckoDelay = 500; // Pro tier
    } else {
      this.logger.warn('No CoinGecko API key found, using free tier');
      this.coingeckoDelay = 1200; // Free tier
    }
  }

  getProviderName(): string {
    return 'coingecko';
  }

  getMappings(): Record<string, Record<string, string>> {
    return COINGECKO_MAPPINGS;
  }

  async getHistoricalPrice(coinId: string, date: Date): Promise<number> {
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

  async preloadPrices(coinId: string): Promise<void> {
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

    const response = await fetch(url, this.getCoingeckoOptions());
    if (!response.ok) {
      throw new Error(`CoinGecko range API error: ${response.status}`);
    }

    const data = await response.json();
    return data.prices || [];
  }

  async fetchOldestAvailablePrice(coinId: string): Promise<number> {
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

      this.logger.debug(`Fetched oldest available price for ${coinId}: ${dateString} = $${price}`);

      return price;
    } catch (error) {
      this.logger.warn(`Failed to fetch oldest available price for ${coinId}: ${error.message}`);
      return 0;
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
}
