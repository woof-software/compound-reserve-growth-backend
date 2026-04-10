import { SyncReserveAssetRole } from '@/modules/sync/enum/sync-reserve-asset-role.enum';

export type SyncReserveItem = {
  chainId: number;
  marketAddress: string;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  assetRole: SyncReserveAssetRole;
  quantity: string;
  price: number;
  value: number;
  timestamp: number;
  blockNumber: number;
  updatedAt: Date;
};
