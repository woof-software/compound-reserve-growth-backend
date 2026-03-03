export type BlockTimingConfigItem = {
  avgBlockTime: number;
  blocksPerDay: number;
};

export type BlockTimingPeriod = BlockTimingConfigItem & {
  startBlock: number;
  endBlock: number;
  description: string;
};

export type FixedBlockTimingNetworkConfig = {
  mode: 'fixed';
} & BlockTimingConfigItem;

export type PeriodicBlockTimingNetworkConfig = {
  mode: 'periods';
  periods: BlockTimingPeriod[];
};

export type BlockTimingNetworkConfig =
  | FixedBlockTimingNetworkConfig
  | PeriodicBlockTimingNetworkConfig;

export type BlockTimingConfigData = {
  networks: Record<string, BlockTimingNetworkConfig>;
};

export interface CachedBlockData {
  blockNumber: number;
  timestamp: number;
  hash: string;
  cachedAt: number;
}
