import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import axios from 'axios';
import { DataSource, QueryFailedError } from 'typeorm';

import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';
import { NetworkService } from 'modules/network/network.service';

import { getAlgorithms } from 'common/utils/get-algorithms';
import { fetchJson } from 'common/utils/fetch-json';

import { SyncRepository } from './repositories/sync.repository';

import { getAssetKey, getSourceKey } from '@/common/utils/reserve-source-keys';
import type { RemoteAsset, RemoteSource } from '@/common/types/remote-reserve-sources.types';
import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

/** One asset to insert, with remote id for mapping sources later */
interface AssetInsertItem {
  remoteId: number;
  asset: Asset;
}

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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async run(): Promise<void> {
    const config = this.getConfig();
    this.logger.log(`Loading reserve data from ${config.repoUrl}`);

    const http = axios.create({ timeout: config.requestTimeoutMs });
    const [rawAssets, rawSources] = await Promise.all([
      fetchJson<unknown>(http, config.rawAssetsUrl),
      fetchJson<unknown>(http, config.rawSourcesUrl),
    ]);

    const remoteAssets = this.parseAssets(rawAssets);
    const remoteSources = this.parseSources(rawSources);

    const [dbAssets, dbSources] = await Promise.all([
      this.syncRepo.listAllAssets(),
      this.syncRepo.listAllSources(),
    ]);

    const assetByKey = new Map<string, Asset>(
      dbAssets.map((a) => [getAssetKey(a.address, a.network), a]),
    );
    const sourceByKey = new Map<string, Source>(
      dbSources.map((s) => [getSourceKey(s.address, s.network, s.algorithm, s.asset.address), s]),
    );

    /** remote asset id (from JSON) -> Asset. Filled for existing now, for new after insert. */
    const remoteIdToAsset = new Map<number, Asset>();
    const assetInserts: AssetInsertItem[] = [];
    const assetUpdates: Asset[] = [];

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
        if (changed) assetUpdates.push(existing);
        remoteIdToAsset.set(remote.id, existing);
      } else {
        const asset = new Asset(
          remote.address,
          remote.decimals,
          remote.symbol,
          network,
          remote.type ?? undefined,
        );
        assetInserts.push({ remoteId: remote.id, asset });
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    try {
      await qr.startTransaction('READ COMMITTED');

      if (assetInserts.length) {
        const toInsert = assetInserts.map((x) => x.asset);
        this.logger.log(
          `Inserting ${toInsert.length} asset(s): ${this.formatAssetBatchLog(toInsert)}`,
        );
        const saved = await this.syncRepo.saveAssets(toInsert, qr.manager);
        for (let i = 0; i < saved.length; i++) {
          remoteIdToAsset.set(assetInserts[i].remoteId, saved[i]);
          assetByKey.set(getAssetKey(saved[i].address, saved[i].network), saved[i]);
        }
        this.logger.log(`Inserted ${saved.length} asset(s)`);
      }

      if (assetUpdates.length) {
        await this.syncRepo.saveAssets(assetUpdates, qr.manager);
        this.logger.warn(`Updated ${assetUpdates.length} asset(s)`);
      }

      const sourceInserts: Source[] = [];
      const sourceUpdates: Source[] = [];

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

        const algorithms = remote.algorithm;

        if (!remote.type) {
          this.logger.warn(`Missing type for source ${remote.id}`);
          continue;
        }

        const key = getSourceKey(remote.address, network, algorithms, asset.address);
        const existingSource = sourceByKey.get(key);

        if (existingSource) {
          const changed = this.applyRemoteToSource(existingSource, remote);
          if (changed) {
            existingSource.checkedAt = new Date();
            sourceUpdates.push(existingSource);
          }
        } else {
          const source = new Source(
            remote.address,
            network,
            algorithms,
            remote.type,
            remote.startBlock,
            asset,
            remote.market ?? undefined,
          );
          sourceInserts.push(source);
          sourceByKey.set(key, source);
        }
      }

      if (sourceInserts.length) {
        this.logger.log(
          `Inserting ${sourceInserts.length} source(s): ${this.formatSourceBatchLog(sourceInserts)}`,
        );
        await this.syncRepo.saveSources(sourceInserts, qr.manager);
        this.logger.log(`Inserted ${sourceInserts.length} source(s)`);
      }

      if (sourceUpdates.length) {
        await this.syncRepo.saveSources(sourceUpdates, qr.manager);
        this.logger.warn(`Updated ${sourceUpdates.length} source(s)`);
      }

      await qr.commitTransaction();
      this.logger.log('Sources update completed.');
    } catch (err) {
      await qr.rollbackTransaction();
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sources update failed (transaction rolled back): ${message}`);
      if (err instanceof QueryFailedError) this.logQueryFailedRow(err);
      throw err;
    } finally {
      await qr.release();
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

  private formatAssetBatchLog(assets: Asset[]): string {
    return assets.map((a) => `${a.address} (${a.network}, ${a.symbol})`).join(', ');
  }

  private formatSourceBatchLog(sources: Source[]): string {
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
