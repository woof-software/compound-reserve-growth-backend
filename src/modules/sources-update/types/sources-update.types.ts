import { AssetEntity } from 'modules/asset/asset.entity';
import { SourceEntity } from 'modules/source/source.entity';

import { RemoteAsset, RemoteSource } from './remote-reserve-sources.types';

/** One asset to insert, with remote id for mapping sources later */
export interface AssetInsertItem {
  remoteId: number;
  asset: AssetEntity;
}

export interface LoadedRemoteData {
  remoteAssets: RemoteAsset[];
  remoteSources: RemoteSource[];
}

export interface DbSyncState {
  assetById: Map<number, AssetEntity>;
  sourceById: Map<number, SourceEntity>;
}

export interface AssetSyncPlan {
  remoteIdToAsset: Map<number, AssetEntity>;
  inserts: AssetInsertItem[];
  updates: AssetEntity[];
  deletes: AssetEntity[];
}

export interface SourceSyncPlan {
  inserts: SourceEntity[];
  updates: SourceEntity[];
  deletes: SourceEntity[];
}
