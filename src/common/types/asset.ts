export interface AssetEntity {
  id: number;
  address: string;
  decimals: number;
  symbol: string;
  network: string;
  type?: string;
  createdAt: Date;
}
