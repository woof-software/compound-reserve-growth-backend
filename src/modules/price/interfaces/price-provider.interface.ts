export interface PriceProviderInterface {
  getHistoricalPrice(coinId: string, date: Date): Promise<number>;

  preloadPrices(coinId: string): Promise<void>;

  getMappings(): Record<string, Record<string, string>>;

  getProviderName(): string;
}
