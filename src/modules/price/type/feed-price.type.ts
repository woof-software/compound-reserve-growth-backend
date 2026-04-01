export type FeedKind = 'direct_usd' | 'quoted' | 'constant' | 'unknown';

export type FeedSnapshot = {
  address: string;
  description: string;
  kind: FeedKind;
  price: number;
  quoteSymbol: string | null;
};

export type FeedPriceRequest = {
  assetSymbol: string;
  blockTag: number;
  date: Date;
  feedAddress: string;
  network: string;
  defaultQuoteFeedAddress?: string | null;
  defaultQuoteSymbol?: string | null;
};
