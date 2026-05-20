export type FileKind = 'assets' | 'sources';

// Logical source labels used in validation errors; data is fetched remotely, not read from disk.
export const ASSETS_FILE_PATH = 'data/assets.json';
// Logical source labels used in validation errors; data is fetched remotely, not read from disk.
export const SOURCES_FILE_PATH = 'data/sources.json';
export const ENFORCE_SOURCE_ASSET_CHAIN_MATCH = true;

export const ASSET_FIELDS = ['id', 'address', 'decimals', 'symbol', 'chainId', 'type'] as const;
export const SOURCE_FIELDS = [
  'id',
  'address',
  'market',
  'algorithm',
  'startBlock',
  'endBlock',
  'chainId',
  'assetId',
  'type',
] as const;
