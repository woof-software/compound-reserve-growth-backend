export type CollateralSourceOutput = {
  sourceId: number;
  network: string;
  market: string | null;
  cometAddress: string;
  collateralAddresses: string[];
};

export type CollateralSearchOutput = {
  generatedAt: string;
  sources: CollateralSourceOutput[];
  missingSources: Array<{
    sourceId: number;
    network: string;
    cometAddress: string;
    reason: string;
  }>;
};

export type CometAssetInfo = {
  offset: bigint;
  asset: string;
  priceFeed: string;
  scale: bigint;
  borrowCollateralFactor: bigint;
  liquidateCollateralFactor: bigint;
  liquidationFactor: bigint;
  supplyCap: bigint;
};

export type BlockTagOverride = {
  blockTag: number;
};

export type CometContract = {
  numAssets(overrides?: BlockTagOverride): Promise<bigint>;
  getAssetInfo(index: number, overrides?: BlockTagOverride): Promise<CometAssetInfo>;
};
