export type QuoteUsdFeedSymbol = 'ETH' | 'BTC' | 'RON';

export interface NetworkConfig {
  network: string;
  chainId: number;
  url: string;
  batchMaxCount?: number;
  quoteUsdFeeds?: Partial<Record<QuoteUsdFeedSymbol, string>>;
  wstEthAddress?: string;
}
