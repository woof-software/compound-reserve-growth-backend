import { ethers } from 'ethers';

import { Algorithm } from '@app/common/enum/algorithm.enum';

export interface MarketAccountingArgs {
  algorithm: Algorithm[] | string[];
  contract: ethers.Contract;
  blockTag: number;
  decimals: number;
  provider: ethers.JsonRpcProvider;
  contractAddress: string;
  network: string;
  asset: { symbol: string };
  assetContract: ethers.Contract;
  date: Date;
}
