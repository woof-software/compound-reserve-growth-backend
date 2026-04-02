import { ethers } from 'ethers';

export interface BlockTagOverride {
  blockTag: number;
}

export interface CometAssetInfo {
  offset: bigint;
  asset: string;
  priceFeed: string;
  scale: bigint;
  borrowCollateralFactor: bigint;
  liquidateCollateralFactor: bigint;
  liquidationFactor: bigint;
  supplyCap: bigint;
}

export interface RawPriceFeedRoundData {
  0: bigint;
  1: bigint;
  2: bigint;
  3: bigint;
  4: bigint;
  roundId: bigint;
  answer: bigint;
  startedAt: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
}

export interface PriceFeedRoundData {
  roundId: bigint;
  answer: bigint;
  startedAt: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
}

export type CometCollateralContract = ethers.Contract & {
  baseToken(overrides?: BlockTagOverride): Promise<string>;
  baseTokenPriceFeed(overrides?: BlockTagOverride): Promise<string>;
  getAssetInfoByAddress(
    assetAddress: string,
    overrides?: BlockTagOverride,
  ): Promise<CometAssetInfo>;
};

export type PriceFeedContract = ethers.Contract & {
  description(overrides?: BlockTagOverride): Promise<string>;
  decimals(overrides?: BlockTagOverride): Promise<bigint>;
  latestRoundData(overrides?: BlockTagOverride): Promise<RawPriceFeedRoundData>;
};

export type TokenMetadataContract = ethers.Contract & {
  symbol(overrides?: BlockTagOverride): Promise<string>;
};
