export type CollateralLifecycleEntry = {
  index: number;
  asset: string;
  appearanceBlock: number;
  deactivationBlock: number | null;
};

export type CollateralSourceOutput = {
  sourceId: number;
  network: string;
  market: string | null;
  cometAddress: string;
  fromBlock: number;
  toBlock: number;
  collaterals: CollateralLifecycleEntry[];
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

export type CollateralLifecycleOutput = {
  network: string;
  cometAddress: string;
  fromBlock: number;
  toBlock: number;
  generatedAt: string;
  assets: CollateralLifecycleEntry[];
};
