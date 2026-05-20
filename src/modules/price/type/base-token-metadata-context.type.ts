import { CometCollateralContract } from './collateral-price-contract.type';

import { ProviderFactory } from '@/common/chains/network/provider.factory';

export type BaseTokenMetadataContext = {
  assetSymbol: string;
  blockTag: number;
  cometContract: CometCollateralContract;
  date: Date;
  network: string;
  provider: ReturnType<ProviderFactory['multicall']>;
};
