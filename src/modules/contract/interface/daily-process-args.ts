import { Contract, JsonRpcProvider } from 'ethers';

import { Source } from 'modules/source/source.entity';

import { Algorithm } from '@app/common/enum/algorithm.enum';

export interface DailyProcessArgs {
  targetTs: number;
  lastBlock: number;
  source: Source;
  network: string;
  provider: JsonRpcProvider;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  algorithm: Algorithm | string;
  contract: Contract;
  assetContract: Contract;
  contractAddress: string;
}
