/**
 * Types for remote reserve data (assets.json / sources.json from compound-reserve-sources repo).
 * Used by asset and source update services.
 */

export type RemoteAsset = {
  id: number;
  address: string;
  decimals: number;
  symbol: string;
  chainId: number;
  type: string | null;
};

export type RemoteSource = {
  id: number;
  address: string;
  market: string | null;
  algorithm: string[];
  startBlock: number;
  endBlock: number | null;
  chainId: number;
  assetId: number;
  type: string | null;
};
