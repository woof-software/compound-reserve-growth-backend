export interface PriceProviderInterface {
  /**
   * Get historical price for a specific coin on a specific date
   * @param coinId - The provider-specific coin identifier
   * @param date - The date for which to get the price
   * @returns Promise resolving to the price in USD, or 0 if not found
   */
  getHistoricalPrice(coinId: string, date: Date): Promise<number>;

  /**
   * Preload historical prices for a coin (bulk data retrieval)
   * @param coinId - The provider-specific coin identifier
   * @returns Promise resolving to array of [timestamp, price] tuples
   */
  preloadPrices(coinId: string): Promise<[number, number][]>;

  /**
   * Get the mapping of symbol to provider-specific coin ID
   * @returns Record mapping symbol strings to coin ID strings
   */
  getMappings(): Record<string, string>;

  /**
   * Get the name/identifier of this price provider
   * @returns The provider name (e.g., 'coingecko', 'coinmarketcap')
   */
  getProviderName(): string;

  /**
   * Fetch the oldest available price for a coin when exact date is not available
   * This is used as a fallback for dates older than available data
   * @param coinId - The provider-specific coin identifier
   * @returns Promise resolving to the oldest available price, or 0 if not found
   */
  fetchOldestAvailablePrice?(coinId: string): Promise<number>;

  /**
   * Get the API type/tier for this provider (affects available history and rate limits)
   * @returns API type string (e.g., 'pro', 'demo', 'free')
   */
  getApiType?(): string;

  /**
   * Get the maximum number of days of historical data this provider can fetch
   * @returns Number of days (e.g., 365 for free tier, 1825 for pro tier)
   */
  getMaxHistoryDays?(): number;

  /**
   * Check if the provider supports a specific symbol
   * @param symbol - The token symbol to check
   * @returns Boolean indicating if the symbol is supported
   */
  supportsSymbol?(symbol: string): boolean;

  /**
   * Get rate limit information for this provider
   * @returns Object with rate limit details
   */
  getRateLimitInfo?(): {
    requestsPerMinute: number;
    delayBetweenRequests: number;
    burstLimit?: number;
  };
}
