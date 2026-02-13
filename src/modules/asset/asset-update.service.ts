import { Injectable, Logger } from '@nestjs/common';

import { NetworkService } from 'modules/network/network.service';

import { getAssetKey } from 'common/utils/reserve-data-keys';
import type { RemoteAsset } from 'common/types/remote-reserve-data.types';

import { Asset } from './asset.entity';
import { AssetService } from './asset.service';

/**
 * Syncs assets from remote reserve data (e.g. assets.json).
 * Creates new records (info log) or updates existing ones (warning log).
 */
@Injectable()
export class AssetUpdateService {
  private readonly logger = new Logger(AssetUpdateService.name);

  constructor(
    private readonly assetService: AssetService,
    private readonly networkService: NetworkService,
  ) {}

  async syncFromRemote(rawData: unknown): Promise<void> {
    const remoteAssets = this.parse(rawData);
    const dbAssets = await this.assetService.listAll();
    const assetByKey = new Map<string, Asset>(
      dbAssets.map((a) => [getAssetKey(a.address, a.network), a]),
    );

    for (const remote of remoteAssets) {
      const network = this.resolveNetwork(remote.chainId);
      if (!network) {
        this.logger.warn(`Unknown chainId for asset ${remote.id}: ${remote.chainId}`);
        continue;
      }
      const key = getAssetKey(remote.address, network);
      let asset = assetByKey.get(key);

      if (asset) {
        const updated = this.applyRemoteToAsset(asset, remote);
        if (updated) {
          await this.assetService.update(asset);
          this.logger.warn(`Updated asset: ${network}/${remote.symbol} (${remote.address})`);
        }
      } else {
        try {
          asset = await this.assetService.findOrCreate({
            address: remote.address,
            decimals: remote.decimals,
            symbol: remote.symbol,
            network,
            type: remote.type ?? undefined,
          });
          assetByKey.set(key, asset);
          this.logger.log(`Added asset: ${network}/${remote.symbol} (${remote.address})`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Asset findOrCreate failed: network=${network}, symbol=${remote.symbol}, address=${remote.address}, chainId=${remote.chainId}, error=${message}`,
          );
          throw err;
        }
      }
    }
  }

  private parse(data: unknown): RemoteAsset[] {
    if (!Array.isArray(data)) {
      throw new Error('assets.json must contain an array');
    }
    const result: RemoteAsset[] = [];
    data.forEach((entry, index) => {
      if (!this.isRecord(entry)) {
        this.logger.warn(`Skipping asset at index ${index}: invalid shape`);
        return;
      }
      const item = entry as RemoteAsset;
      result.push({
        id: item.id,
        address: item.address,
        decimals: item.decimals,
        symbol: item.symbol,
        chainId: item.chainId,
        type: item.type ?? null,
      });
    });
    return result;
  }

  private resolveNetwork(chainId: number): string | null {
    return this.networkService.byChainId(chainId)?.network ?? null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /** Returns true if any field was changed. */
  private applyRemoteToAsset(asset: Asset, remote: RemoteAsset): boolean {
    let changed = false;
    if (asset.decimals !== remote.decimals) {
      asset.decimals = remote.decimals;
      changed = true;
    }
    if (asset.symbol !== remote.symbol) {
      asset.symbol = remote.symbol;
      changed = true;
    }
    const remoteType = remote.type ?? undefined;
    if (asset.type !== remoteType) {
      asset.type = remoteType;
      changed = true;
    }
    return changed;
  }
}
