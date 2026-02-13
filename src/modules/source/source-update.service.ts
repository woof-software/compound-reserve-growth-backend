import { Injectable, Logger } from '@nestjs/common';

import { Asset } from 'modules/asset/asset.entity';
import { AssetService } from 'modules/asset/asset.service';
import { NetworkService } from 'modules/network/network.service';

import { getSourceKey } from 'common/utils/reserve-data-keys';
import type { RemoteSource } from 'common/types/remote-reserve-data.types';

import { Source } from './source.entity';
import { SourceService } from './source.service';

/**
 * Syncs sources from remote reserve data (e.g. sources.json).
 * Creates new records (info log) or updates existing ones (warning log).
 * Resolves asset by id (remote.assetId = DB asset id).
 */
@Injectable()
export class SourceUpdateService {
  private readonly logger = new Logger(SourceUpdateService.name);

  constructor(
    private readonly sourceService: SourceService,
    private readonly assetService: AssetService,
    private readonly networkService: NetworkService,
  ) {}

  async syncFromRemote(rawData: unknown): Promise<void> {
    const remoteSources = this.parse(rawData);
    const dbSources = await this.sourceService.listAll();
    const sourceByKey = new Map<string, Source>(
      dbSources.map((s) => [getSourceKey(s.address, s.network, s.algorithm, s.asset.address), s]),
    );

    for (const remote of remoteSources) {
      let asset: Asset;
      try {
        asset = await this.assetService.findById(remote.assetId);
      } catch {
        this.logger.warn(`Missing asset for source ${remote.id} (assetId: ${remote.assetId})`);
        continue;
      }

      const network = this.resolveNetwork(remote.chainId);
      if (!network) {
        this.logger.warn(`Unknown chainId for source ${remote.id}: ${remote.chainId}`);
        continue;
      }

      const algorithms = this.normalizeAlgorithms(remote.algorithm);
      if (!algorithms.length) {
        this.logger.warn(`Missing algorithm for source ${remote.id}`);
        continue;
      }

      if (!remote.type) {
        this.logger.warn(`Missing type for source ${remote.id}`);
        continue;
      }

      const key = getSourceKey(remote.address, network, algorithms, asset.address);
      const source = sourceByKey.get(key);

      if (source) {
        const updated = this.applyRemoteToSource(source, remote);
        if (updated) {
          await this.sourceService.updateWithSource({
            source,
            blockNumber: remote.startBlock,
            checkedAt: new Date(),
          });
          this.logger.warn(`Updated source: ${network}/${remote.address}`);
        }
      } else {
        const created = await this.sourceService.createWithAsset({
          address: remote.address,
          network,
          algorithm: algorithms,
          type: remote.type,
          blockNumber: remote.startBlock,
          asset,
          market: remote.market ?? undefined,
        });
        sourceByKey.set(key, created);
        this.logger.log(`Added source: ${network}/${remote.address}`);
      }
    }
  }

  private parse(data: unknown): RemoteSource[] {
    if (!Array.isArray(data)) {
      throw new Error('sources.json must contain an array');
    }
    const result: RemoteSource[] = [];
    data.forEach((entry, index) => {
      if (!this.isRecord(entry)) {
        this.logger.warn(`Skipping source at index ${index}: invalid shape`);
        return;
      }
      const item = entry as Omit<RemoteSource, 'algorithm'> & { algorithm: unknown };
      result.push({
        id: item.id,
        address: item.address,
        market: item.market ?? null,
        algorithm: this.parseAlgorithm(item.algorithm),
        startBlock: item.startBlock,
        endBlock: item.endBlock ?? null,
        chainId: item.chainId,
        assetId: item.assetId,
        type: item.type ?? null,
      });
    });
    return result;
  }

  private normalizeAlgorithms(algorithms: RemoteSource['algorithm']): string[] {
    return algorithms.map((a) => a.trim()).filter((a) => a.length > 0);
  }

  private parseAlgorithm(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((e) => String(e).trim()).filter((e) => e.length > 0);
    }
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    const withoutBraces =
      trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
    return withoutBraces
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }

  private resolveNetwork(chainId: number): string | null {
    return this.networkService.byChainId(chainId)?.network ?? null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /** Returns true if any field was changed. */
  private applyRemoteToSource(source: Source, remote: RemoteSource): boolean {
    let changed = false;
    if (source.blockNumber !== remote.startBlock) {
      source.blockNumber = remote.startBlock;
      changed = true;
    }
    const remoteMarket = remote.market ?? undefined;
    if (source.market !== remoteMarket) {
      source.market = remoteMarket;
      changed = true;
    }
    return changed;
  }
}
