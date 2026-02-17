import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EntityManager, QueryFailedError } from 'typeorm';

import { AssetEntity } from 'modules/asset/asset.entity';
import { SourceEntity } from 'modules/source/source.entity';
import { NetworkService } from 'modules/network/network.service';

import {
  AssetInsertItem,
  AssetSyncPlan,
  DbSyncState,
  LoadedRemoteData,
  SourceSyncPlan,
} from './types/sources-update.types';
import { SyncRepository } from './repositories/sync.repository';
import type { RemoteAsset, RemoteSource } from './types/remote-reserve-sources.types';
import { SourcesUpdateValidationService } from './sources-validator';

import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

/**
 * Syncs assets and sources from remote reserve data in a single transaction.
 * 1. Prepares batches (assets then sources) from remote data and current DB state.
 * 2. In one transaction: upserts assets, inserts/updates/deletes sources, then deletes stale assets.
 * 3. On any error rolls back and throws; no partial apply.
 */
@Injectable()
export class SourcesUpdateService {
  private readonly logger = new Logger(SourcesUpdateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly networkService: NetworkService,
    private readonly syncRepo: SyncRepository,
    private readonly validationService: SourcesUpdateValidationService,
  ) {}

  async run(): Promise<void> {
    const config = this.getConfig();
    const { remoteAssets, remoteSources } = await this.fetchRemoteData(config);

    try {
      await this.syncRepo.inTransaction(async (manager) => {
        const dbState = await this.loadDbSyncState(manager);
        const assetPlan = this.prepareAssetSyncPlan(remoteAssets, dbState.assetById);
        await this.persistAssetUpserts(assetPlan, dbState.assetById, manager);
        const sourcePlan = this.prepareSourceSyncPlan(
          remoteSources,
          assetPlan.remoteIdToAsset,
          dbState.sourceById,
        );
        await this.persistSourceChanges(sourcePlan, manager);
        await this.persistAssetDeletes(assetPlan, manager);
      });
      this.logger.log('Sources update completed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sources update failed (transaction rolled back): ${message}`);
      if (err instanceof QueryFailedError) this.logQueryFailedRow(err);
      throw err;
    }
  }

  private async fetchRemoteData(config: ReserveSourcesConfig): Promise<LoadedRemoteData> {
    this.logger.log(`Loading reserve data from ${config.repoUrl}`);
    const http = axios.create({ timeout: config.requestTimeoutMs });
    const [rawAssets, rawSources] = await Promise.all([
      http.get<unknown>(config.rawAssetsUrl, { responseType: 'json' }).then((r) => r.data),
      http.get<unknown>(config.rawSourcesUrl, { responseType: 'json' }).then((r) => r.data),
    ]);
    const validated = await this.validationService.validateAll({
      assetsRaw: rawAssets,
      sourcesRaw: rawSources,
    });
    return { remoteAssets: validated.assets, remoteSources: validated.sources };
  }

  private async loadDbSyncState(manager: EntityManager): Promise<DbSyncState> {
    const [dbAssets, dbSources] = await Promise.all([
      this.syncRepo.listAllAssets(manager),
      this.syncRepo.listAllSources(manager),
    ]);

    return {
      assetById: new Map<number, AssetEntity>(dbAssets.map((a) => [a.id, a])),
      sourceById: new Map<number, SourceEntity>(dbSources.map((s) => [s.id, s])),
    };
  }

  private prepareAssetSyncPlan(
    remoteAssets: RemoteAsset[],
    assetById: Map<number, AssetEntity>,
  ): AssetSyncPlan {
    const remoteIdToAsset = new Map<number, AssetEntity>();
    const inserts: AssetInsertItem[] = [];
    const updates: AssetEntity[] = [];
    const seenRemoteIds = new Set<number>();
    const existingAssetById = new Map<number, AssetEntity>(assetById);

    for (const remote of remoteAssets) {
      const network = this.resolveNetwork(remote.chainId);
      if (!network) {
        this.logger.warn(`Unknown chainId for asset ${remote.id}: ${remote.chainId}`);
        continue;
      }

      seenRemoteIds.add(remote.id);
      const existing = assetById.get(remote.id);

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
      asset.id = remote.id;
      inserts.push({ remoteId: remote.id, asset });
    }

    const deletes = Array.from(existingAssetById.entries())
      .filter(([id]) => !seenRemoteIds.has(id))
      .map(([, asset]) => asset);

    return { remoteIdToAsset, inserts, updates, deletes };
  }

  private async persistAssetUpserts(
    assetPlan: AssetSyncPlan,
    assetById: Map<number, AssetEntity>,
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
        assetById.set(saved[i].id, saved[i]);
      }
      this.logger.log(`Inserted ${saved.length} asset(s)`);
    }

    if (assetPlan.updates.length) {
      await this.syncRepo.saveAssets(assetPlan.updates, manager);
      this.logger.warn(`Updated ${assetPlan.updates.length} asset(s)`);
    }
  }

  private async persistAssetDeletes(
    assetPlan: AssetSyncPlan,
    manager: EntityManager,
  ): Promise<void> {
    if (!assetPlan.deletes.length) return;

    const idsToDelete = assetPlan.deletes
      .map((asset) => asset.id)
      .filter((id): id is number => typeof id === 'number');

    this.logger.warn(
      `Deleting ${idsToDelete.length} stale asset(s): ${this.formatAssetBatchLog(assetPlan.deletes)}`,
    );
    await this.syncRepo.deleteAssetsByIds(idsToDelete, manager);
    this.logger.warn(`Deleted ${idsToDelete.length} stale asset(s)`);
  }

  private prepareSourceSyncPlan(
    remoteSources: RemoteSource[],
    remoteIdToAsset: Map<number, AssetEntity>,
    sourceById: Map<number, SourceEntity>,
  ): SourceSyncPlan {
    const inserts: SourceEntity[] = [];
    const updates: SourceEntity[] = [];
    const seenRemoteIds = new Set<number>();
    const existingSourceById = new Map<number, SourceEntity>(sourceById);

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

      seenRemoteIds.add(remote.id);
      const existingSource = sourceById.get(remote.id);

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
      source.id = remote.id;
      inserts.push(source);
      sourceById.set(source.id, source);
    }

    const deletes = Array.from(existingSourceById.entries())
      .filter(([id]) => !seenRemoteIds.has(id))
      .map(([, source]) => source);

    return { inserts, updates, deletes };
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

    if (sourcePlan.deletes.length) {
      const idsToDelete = sourcePlan.deletes
        .map((source) => source.id)
        .filter((id): id is number => typeof id === 'number');

      this.logger.warn(
        `Deleting ${idsToDelete.length} stale source(s): ${this.formatSourceBatchLog(sourcePlan.deletes)}`,
      );
      await this.syncRepo.deleteSourcesByIds(idsToDelete, manager);
      this.logger.warn(`Deleted ${idsToDelete.length} stale source(s)`);
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

  private applyRemoteToAsset(asset: AssetEntity, remote: RemoteAsset): boolean {
    let changed = false;
    if (asset.address !== remote.address) {
      asset.address = remote.address;
      changed = true;
    }
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
    if (source.address !== remote.address) {
      source.address = remote.address;
      changed = true;
    }
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
