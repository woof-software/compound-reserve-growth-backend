import { ethers } from 'ethers';

import { BlockTagOverride } from './collateral-price-contract.type';

export type CanonicalQuoteSymbol = 'USD' | 'ETH' | 'BTC' | 'wstETH' | 'RON';

export type QuotePriceRequest = {
  blockTag: number;
  date: Date;
  network: string;
  symbol: string;
};

export type WstEthContract = ethers.Contract & {
  stEthPerToken(overrides?: BlockTagOverride): Promise<bigint>;
};
