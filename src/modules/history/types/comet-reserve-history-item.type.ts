import { AssetRole } from '@/modules/history/enum/comet-reserve-type.enum';

export type CometReserveHistoryItem = {
  chainId: number;
  marketAddress: string;
  assetAddress: string;
  assetRole: AssetRole;
  quantity: string;
  price: number;
  value: number;
  timestamp: number;
  blockNumber: number;
};
