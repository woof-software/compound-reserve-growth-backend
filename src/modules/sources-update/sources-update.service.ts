import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EntityManager, QueryFailedError } from 'typeorm';

import { AssetEntity } from 'modules/asset/asset.entity';
import { SourceEntity } from 'modules/source/source.entity';
import { NetworkService } from 'modules/network/network.service';

import { getAlgorithms } from './helpers/get-algorithms';
import {
  AssetInsertItem,
  AssetSyncPlan,
  DbSyncState,
  LoadedRemoteData,
  SourceSyncPlan,
} from './types/sources-update.types';
import { SyncRepository } from './repositories/sync.repository';
import type { RemoteAsset, RemoteSource } from './types/remote-reserve-sources.types';
import { getAssetKey, getSourceKey } from './helpers/reserve-source-keys';

import { fetchJson } from '@/common/utils/fetch-json';
import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

/**
 * Syncs assets and sources from remote reserve data in a single transaction.
 * 1. Prepares batches (assets then sources) from remote data and current DB state.
 * 2. In one transaction: inserts/updates all assets, then inserts/updates all sources.
 * 3. On any error rolls back and throws; no partial apply.
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
    const { remoteAssets, remoteSources } = await this.loadRemoteData(config);

    try {
      await this.syncRepo.inTransaction(async (manager) => {
        const dbState = await this.loadDbSyncState(manager);
        const assetPlan = this.prepareAssetSyncPlan(remoteAssets, dbState.assetByKey);
        await this.persistAssetChanges(assetPlan, dbState.assetByKey, manager);
        const sourcePlan = this.prepareSourceSyncPlan(
          remoteSources,
          assetPlan.remoteIdToAsset,
          dbState.sourceByKey,
        );
        await this.persistSourceChanges(sourcePlan, manager);
      });
      this.logger.log('Sources update completed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sources update failed (transaction rolled back): ${message}`);
      if (err instanceof QueryFailedError) this.logQueryFailedRow(err);
      throw err;
    }
  }

  private async loadRemoteData(config: ReserveSourcesConfig): Promise<LoadedRemoteData> {
    this.logger.log(`Loading reserve data from ${config.repoUrl}`);
    const http = axios.create({ timeout: config.requestTimeoutMs });
    const [rawAssets, rawSources] = await Promise.all([
      fetchJson<unknown>(http, config.rawAssetsUrl),
      fetchJson<unknown>(http, config.rawSourcesUrl),
    ]);
    return {
      remoteAssets: this.parseAssets(rawAssets),
      remoteSources: this.parseSources(rawSources),
    };
  }

  private async loadDbSyncState(manager: EntityManager): Promise<DbSyncState> {
    const [dbAssets, dbSources] = await Promise.all([
      this.syncRepo.listAllAssets(manager),
      this.syncRepo.listAllSources(manager),
    ]);

    return {
      assetByKey: new Map<string, AssetEntity>(
        dbAssets.map((a) => [getAssetKey(a.address, a.network), a]),
      ),
      sourceByKey: new Map<string, SourceEntity>(
        dbSources.map((s) => [getSourceKey(s.address, s.network, s.algorithm, s.asset.address), s]),
      ),
    };
  }

  private prepareAssetSyncPlan(
    remoteAssets: RemoteAsset[],
    assetByKey: Map<string, AssetEntity>,
  ): AssetSyncPlan {
    const remoteIdToAsset = new Map<number, AssetEntity>();
    const inserts: AssetInsertItem[] = [];
    const updates: AssetEntity[] = [];

    for (const remote of remoteAssets) {
      const network = this.resolveNetwork(remote.chainId);
      if (!network) {
        this.logger.warn(`Unknown chainId for asset ${remote.id}: ${remote.chainId}`);
        continue;
      }

      const key = getAssetKey(remote.address, network);
      const existing = assetByKey.get(key);

      if (existing) {
        const changed = this.applyRemoteToAsset(existing, remote);
        if (changed) updates.push(existing);
        remoteIdToAsset.set(remote.id, existing);
        continue;
      }

      const asset = new AssetEntity(
        remote.address,
        remote.decimals,
        remote.symbol,
        network,
        remote.type ?? undefined,
      );
      inserts.push({ remoteId: remote.id, asset });
    }

    return { remoteIdToAsset, inserts, updates };
  }

  private async persistAssetChanges(
    assetPlan: AssetSyncPlan,
    assetByKey: Map<string, AssetEntity>,
    manager: EntityManager,
  ): Promise<void> {
    if (assetPlan.inserts.length) {
      const toInsert = assetPlan.inserts.map((x) => x.asset);
      this.logger.log(
        `Inserting ${toInsert.length} asset(s): ${this.formatAssetBatchLog(toInsert)}`,
      );
      const saved = await this.syncRepo.saveAssets(toInsert, manager);
      for (let i = 0; i < saved.length; i++) {
        assetPlan.remoteIdToAsset.set(assetPlan.inserts[i].remoteId, saved[i]);
        assetByKey.set(getAssetKey(saved[i].address, saved[i].network), saved[i]);
      }
      this.logger.log(`Inserted ${saved.length} asset(s)`);
    }

    if (assetPlan.updates.length) {
      await this.syncRepo.saveAssets(assetPlan.updates, manager);
      this.logger.warn(`Updated ${assetPlan.updates.length} asset(s)`);
    }
  }

  private prepareSourceSyncPlan(
    remoteSources: RemoteSource[],
    remoteIdToAsset: Map<number, AssetEntity>,
    sourceByKey: Map<string, SourceEntity>,
  ): SourceSyncPlan {
    const inserts: SourceEntity[] = [];
    const updates: SourceEntity[] = [];

    for (const remote of remoteSources) {
      const asset = remoteIdToAsset.get(remote.assetId);
      if (!asset) {
        this.logger.warn(
          `Skipping source id=${remote.id}: asset not found for assetId=${remote.assetId}`,
        );
        continue;
      }

      const network = this.resolveNetwork(remote.chainId);
      if (!network) {
        this.logger.warn(`Unknown chainId for source ${remote.id}: ${remote.chainId}`);
        continue;
      }

      if (!remote.type) {
        this.logger.warn(`Missing type for source ${remote.id}`);
        continue;
      }

      const key = getSourceKey(remote.address, network, remote.algorithm, asset.address);
      const existingSource = sourceByKey.get(key);

      if (existingSource) {
        const changed = this.applyRemoteToSource(existingSource, remote, asset);
        if (changed) {
          existingSource.checkedAt = new Date();
          updates.push(existingSource);
        }
        continue;
      }

      const source = new SourceEntity(
        remote.address,
        network,
        remote.algorithm,
        remote.type,
        remote.startBlock,
        asset,
        remote.market ?? undefined,
      );
      inserts.push(source);
      sourceByKey.set(key, source);
    }

    return { inserts, updates };
  }

  private async persistSourceChanges(
    sourcePlan: SourceSyncPlan,
    manager: EntityManager,
  ): Promise<void> {
    if (sourcePlan.inserts.length) {
      this.logger.log(
        `Inserting ${sourcePlan.inserts.length} source(s): ${this.formatSourceBatchLog(sourcePlan.inserts)}`,
      );
      await this.syncRepo.saveSources(sourcePlan.inserts, manager);
      this.logger.log(`Inserted ${sourcePlan.inserts.length} source(s)`);
    }

    if (sourcePlan.updates.length) {
      await this.syncRepo.saveSources(sourcePlan.updates, manager);
      this.logger.warn(`Updated ${sourcePlan.updates.length} source(s)`);
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
        algorithm: getAlgorithms(item.algorithm),
        startBlock: item.startBlock,
        endBlock: item.endBlock ?? null,
        chainId: item.chainId,
        assetId: item.assetId,
        type: item.type ?? null,
      });
    });
    return result;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private applyRemoteToAsset(asset: AssetEntity, remote: RemoteAsset): boolean {
    let changed = false;
    const network = this.resolveNetwork(remote.chainId);
    if (network && asset.network !== network) {
      asset.network = network;
      changed = true;
    }
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

  private applyRemoteToSource(
    source: SourceEntity,
    remote: RemoteSource,
    asset: AssetEntity,
  ): boolean {
    let changed = false;
    const network = this.resolveNetwork(remote.chainId);
    if (network && source.network !== network) {
      source.network = network;
      changed = true;
    }
    if (source.asset?.id !== asset.id) {
      source.asset = asset;
      changed = true;
    }
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
    if (!this.algorithmEqual(source.algorithm, remote.algorithm)) {
      source.algorithm = [...remote.algorithm];
      changed = true;
    }
    const currentType = source.type ?? undefined;
    const remoteType = remote.type ?? undefined;
    if (currentType !== remoteType) {
      source.type = remoteType;
      changed = true;
    }
    return changed;
  }

  private algorithmEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private formatAssetBatchLog(assets: AssetEntity[]): string {
    return assets.map((a) => `${a.address} (${a.network}, ${a.symbol})`).join(', ');
  }

  private formatSourceBatchLog(sources: SourceEntity[]): string {
    return sources.map((s) => `${s.address} (${s.network}, asset: ${s.asset.address})`).join(', ');
  }

  private logQueryFailedRow(err: QueryFailedError): void {
    if (!err.parameters) return;
    const params = Array.isArray(err.parameters) ? err.parameters : [err.parameters];
    this.logger.error(
      `Failed row data (query params): address=${params[0] ?? '?'}, decimals=${params[1] ?? '?'}, symbol=${params[2] ?? '?'}, network=${params[3] ?? '?'}`,
    );
  }
}
