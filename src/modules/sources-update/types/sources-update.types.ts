import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';

import { RemoteAsset, RemoteSource } from './remote-reserve-sources.types';

/** One asset to insert, with remote id for mapping sources later */
export interface AssetInsertItem {
  remoteId: number;
  asset: Asset;
}

export interface LoadedRemoteData {
  remoteAssets: RemoteAsset[];
  remoteSources: RemoteSource[];
}

export interface DbSyncState {
  assetByKey: Map<string, Asset>;
  sourceByKey: Map<string, Source>;
}

export interface AssetSyncPlan {
  remoteIdToAsset: Map<number, Asset>;
  inserts: AssetInsertItem[];
  updates: Asset[];
}

export interface SourceSyncPlan {
  inserts: Source[];
  updates: Source[];
}
