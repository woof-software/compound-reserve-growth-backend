import { CometReserveType } from 'modules/history/enum/comet-reserve-type.enum';

export type CometReserveHistoryItem = {
  sourceAddress: string;
  quantity: string;
  value: number;
  price: number;
  chainId: number;
  timestamp: number;
  blockNumber: number;
  reserveType: CometReserveType;
};
