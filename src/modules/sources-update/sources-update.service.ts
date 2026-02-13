import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { getAssetKey, getSourceKey } from 'common/utils/reserve-data-keys';
import { fetchJson } from 'common/utils/fetch-json';
import type { RemoteAsset, RemoteSource } from 'common/types/remote-reserve-data.types';

import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';
import { NetworkService } from 'modules/network/network.service';

import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

import { SyncRepository } from './repositories/sync.repository';

/**
 * Syncs assets and sources from remote reserve data.
 * Fetches data once, then runs asset sync and source sync sequentially.
 * Uses own repository; only Asset and Source entities are imported from their modules.
 */
@Injectable()
export class SourcesUpdateService {
  private readonly logger = new Logger(SourcesUpdateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly networkService: NetworkService,
    private readonly syncRepo: SyncRepository,
  ) {}

  async run(): Promise<void> {
    const config = this.getConfig();
    this.logger.log(`Loading reserve data from ${config.repoUrl}`);

    const http = axios.create({ timeout: config.requestTimeoutMs });
    const [rawAssets, rawSources] = await Promise.all([
      fetchJson<unknown>(http, config.rawAssetsUrl),
      fetchJson<unknown>(http, config.rawSourcesUrl),
    ]);

    await this.syncAssetsFromRemote(rawAssets);
    await this.syncSourcesFromRemote(rawSources);

    this.logger.log('Source update completed.');
  }

  async syncAssetsFromRemote(rawData: unknown): Promise<void> {
    const remoteAssets = this.parseAssets(rawData);
    const dbAssets = await this.syncRepo.listAllAssets();
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
          await this.syncRepo.saveAsset(asset);
          this.logger.warn(`Updated asset: ${network}/${remote.symbol} (${remote.address})`);
        }
      } else {
        try {
          asset = await this.findOrCreateAsset(remote, network);
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

  async syncSourcesFromRemote(rawData: unknown): Promise<void> {
    const remoteSources = this.parseSources(rawData);
    const dbSources = await this.syncRepo.listAllSources();
    const sourceByKey = new Map<string, Source>(
      dbSources.map((s) => [getSourceKey(s.address, s.network, s.algorithm, s.asset.address), s]),
    );

    for (const remote of remoteSources) {
      let asset: Asset | null;
      try {
        asset = await this.syncRepo.findAssetById(remote.assetId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Source sync: missing asset for source id=${remote.id}, address=${remote.address}, assetId=${remote.assetId}, error=${message}`,
        );
        continue;
      }
      if (!asset) {
        this.logger.error(
          `Source sync: asset not found for source id=${remote.id}, assetId=${remote.assetId}`,
        );
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
          try {
            source.checkedAt = new Date();
            await this.syncRepo.saveSource(source);
            this.logger.warn(`Updated source: ${network}/${remote.address}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Source update failed: network=${network}, address=${remote.address}, sourceId=${remote.id}, error=${message}`,
            );
            throw err;
          }
        }
      } else {
        try {
          const created = new Source(
            remote.address,
            network,
            algorithms,
            remote.type,
            remote.startBlock,
            asset,
            remote.market ?? undefined,
          );
          const saved = await this.syncRepo.saveSource(created);
          sourceByKey.set(key, saved);
          this.logger.log(`Added source: ${network}/${remote.address}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Source create failed: network=${network}, address=${remote.address}, sourceId=${remote.id}, assetId=${remote.assetId}, error=${message}`,
          );
          throw err;
        }
      }
    }
  }

  private getConfig(): ReserveSourcesConfig {
    const config = this.configService.get<ReserveSourcesConfig>('reserveSources');
    if (!config) {
      throw new Error('reserveSources config is missing');
    }
    return config;
  }

  private resolveNetwork(chainId: number): string | null {
    return this.networkService.byChainId(chainId)?.network ?? null;
  }

  private async findOrCreateAsset(remote: RemoteAsset, network: string): Promise<Asset> {
    const existing = await this.syncRepo.findAssetByAddressAndNetwork(remote.address, network);
    if (existing) return existing;
    const asset = new Asset(
      remote.address,
      remote.decimals,
      remote.symbol,
      network,
      remote.type ?? undefined,
    );
    return this.syncRepo.saveAsset(asset);
  }

  private parseAssets(data: unknown): RemoteAsset[] {
    if (!Array.isArray(data)) throw new Error('assets.json must contain an array');
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

  private parseSources(data: unknown): RemoteSource[] {
    if (!Array.isArray(data)) throw new Error('sources.json must contain an array');
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

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

  private applyRemoteToSource(source: Source, remote: RemoteSource): boolean {
    let changed = false;
    if (source.blockNumber !== remote.startBlock) {
      source.blockNumber = remote.startBlock;
      changed = true;
    }
    const currentMarket = source.market ?? undefined;
    const remoteMarket = remote.market ?? undefined;
    if (currentMarket !== remoteMarket) {
      source.market = remoteMarket;
      changed = true;
    }
    return changed;
  }
}
