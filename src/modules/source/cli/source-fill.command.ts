import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command, CommandRunner } from 'nest-commander';
import axios, { AxiosInstance } from 'axios';

import { Asset } from 'modules/asset/asset.entity';
import { AssetService } from 'modules/asset/asset.service';
import { NetworkService } from 'modules/network/network.service';
import { Source } from 'modules/source/source.entity';
import { SourceService } from 'modules/source/source.service';
import type { RemoteAsset, RemoteSource } from 'modules/source/source.types';

import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

@Command({ name: 'source:fill', description: 'Fill sources and assets from repo data' })
export class SourceFillCommand extends CommandRunner {
  private readonly logger = new Logger(SourceFillCommand.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sourceService: SourceService,
    private readonly assetService: AssetService,
    private readonly networkService: NetworkService,
  ) {
    super();
  }

  async run(): Promise<void> {
    try {
      const config = this.getConfig();
      this.logger.log(`Loading reserve sources from ${config.repoUrl}`);

      const http = axios.create({ timeout: config.requestTimeoutMs });
      const [rawAssets, rawSources] = await Promise.all([
        this.fetchJson<unknown>(http, config.rawAssetsUrl),
        this.fetchJson<unknown>(http, config.rawSourcesUrl),
      ]);

      const remoteAssets = this.parseAssets(rawAssets);
      const remoteSources = this.parseSources(rawSources);

      this.logger.log(`Fetched ${remoteAssets.length} assets and ${remoteSources.length} sources`);

      const dbAssets = await this.assetService.listAll();
      const assetByKey = new Map<string, Asset>(
        dbAssets.map((asset) => [this.getAssetKey(asset.address, asset.network), asset]),
      );
      const assetByRemoteId = new Map<number, Asset>();

      let createdAssets = 0;
      for (const remoteAsset of remoteAssets) {
        const network = this.resolveNetwork(remoteAsset.chainId);
        if (!network) {
          this.logger.warn(`Unknown chainId for asset ${remoteAsset.id}: ${remoteAsset.chainId}`);
          continue;
        }
        const key = this.getAssetKey(remoteAsset.address, network);
        let asset = assetByKey.get(key);
        if (!asset) {
          asset = await this.assetService.findOrCreate({
            address: remoteAsset.address,
            decimals: remoteAsset.decimals,
            symbol: remoteAsset.symbol,
            network,
            type: remoteAsset.type ?? undefined,
          });
          assetByKey.set(key, asset);
          createdAssets += 1;
          this.logger.log(`Added asset: ${network}/${remoteAsset.symbol}`);
        }
        assetByRemoteId.set(remoteAsset.id, asset);
      }

      const dbSources = await this.sourceService.listAll();
      const existingSourceKeys = new Set(
        dbSources.map((source) =>
          this.getSourceKey(source.address, source.network, source.algorithm, source.asset.address),
        ),
      );

      let createdSources = 0;
      for (const remoteSource of remoteSources) {
        const asset = assetByRemoteId.get(remoteSource.assetId);
        if (!asset) {
          this.logger.warn(
            `Missing asset for source ${remoteSource.id} (assetId: ${remoteSource.assetId})`,
          );
          continue;
        }

        const network = this.resolveNetwork(remoteSource.chainId);
        if (!network) {
          this.logger.warn(
            `Unknown chainId for source ${remoteSource.id}: ${remoteSource.chainId}`,
          );
          continue;
        }

        const algorithms = this.normalizeAlgorithms(remoteSource.algorithm);
        if (!algorithms.length) {
          this.logger.warn(`Missing algorithm for source ${remoteSource.id}`);
          continue;
        }

        if (!remoteSource.type) {
          this.logger.warn(`Missing type for source ${remoteSource.id}`);
          continue;
        }

        const key = this.getSourceKey(remoteSource.address, network, algorithms, asset.address);
        if (existingSourceKeys.has(key)) continue;

        const newSource = new Source(
          remoteSource.address,
          network,
          algorithms,
          remoteSource.type,
          remoteSource.startBlock,
          asset,
          remoteSource.market ?? undefined,
        );

        await this.sourceService.createWithAsset(newSource);
        existingSourceKeys.add(key);
        createdSources += 1;
        this.logger.log(`Added source: ${network}/${remoteSource.address}`);
      }

      this.logger.log(
        `Source fill completed. Created ${createdAssets} assets and ${createdSources} sources.`,
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while filling sources and assets:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private getConfig(): ReserveSourcesConfig {
    const config = this.configService.get<ReserveSourcesConfig>('reserveSources');
    if (!config) {
      throw new Error('reserveSources config is missing');
    }
    return config;
  }

  private async fetchJson<T>(http: AxiosInstance, url: string): Promise<T> {
    const response = await http.get<T>(url, { responseType: 'json' });
    return response.data;
  }

  private parseAssets(data: unknown): RemoteAsset[] {
    if (!Array.isArray(data)) {
      throw new Error('asset.json must contain an array');
    }

    const assets: RemoteAsset[] = [];
    data.forEach((entry, index) => {
      if (!this.isRecord(entry)) {
        this.logger.warn(`Skipping asset at index ${index}: invalid shape`);
        return;
      }
      const asset = entry as RemoteAsset;
      assets.push({
        id: asset.id,
        address: asset.address,
        decimals: asset.decimals,
        symbol: asset.symbol,
        chainId: asset.chainId,
        type: asset.type ?? null,
      });
    });

    return assets;
  }

  private parseSources(data: unknown): RemoteSource[] {
    if (!Array.isArray(data)) {
      throw new Error('source.json must contain an array');
    }

    const sources: RemoteSource[] = [];
    data.forEach((entry, index) => {
      if (!this.isRecord(entry)) {
        this.logger.warn(`Skipping source at index ${index}: invalid shape`);
        return;
      }
      const source = entry as Omit<RemoteSource, 'algorithm'> & { algorithm: unknown };
      sources.push({
        id: source.id,
        address: source.address,
        market: source.market ?? null,
        algorithm: this.parseAlgorithm(source.algorithm),
        startBlock: source.startBlock,
        endBlock: source.endBlock ?? null,
        chainId: source.chainId,
        assetId: source.assetId,
        type: source.type ?? null,
      });
    });

    return sources;
  }

  private normalizeAlgorithms(algorithms: RemoteSource['algorithm']): string[] {
    return algorithms.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }

  private parseAlgorithm(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
    }
    if (typeof value !== 'string') {
      return [];
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    const withoutBraces =
      trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
    return withoutBraces
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private resolveNetwork(chainId: number): string | null {
    return this.networkService.byChainId(chainId)?.network ?? null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getAssetKey(address: string, network: string): string {
    return `${network.toLowerCase()}:${address.toLowerCase()}`;
  }

  private getSourceKey(
    address: string,
    network: string,
    algorithms: string[],
    assetAddress: string,
  ): string {
    const algoKey = [...algorithms]
      .map((entry) => entry.toLowerCase())
      .sort()
      .join('|');
    return `${network.toLowerCase()}:${address.toLowerCase()}:${algoKey}:${assetAddress.toLowerCase()}`;
  }
}
