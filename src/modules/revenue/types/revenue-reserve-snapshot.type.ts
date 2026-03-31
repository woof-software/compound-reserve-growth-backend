export type RevenueReserveSnapshot = {
  reserveId: number;
  sourceId: number;
  blockNumber: number;
  date: Date;
  price: number;
  quantity: string;
  decimals: number;
  isLookback: boolean;
};
