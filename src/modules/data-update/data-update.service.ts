import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { AssetUpdateService } from 'modules/asset/asset-update.service';
import { SourceUpdateService } from 'modules/source/source-update.service';

import { fetchJson } from 'common/utils/fetch-json';

import type { ReserveSourcesConfig } from 'config/reserve-sources.config';

/**
 * Orchestrates sync of assets and sources from remote reserve data.
 * Fetches data once, then runs asset sync and source sync sequentially.
 */
@Injectable()
export class DataUpdateService {
  private readonly logger = new Logger(DataUpdateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly assetUpdateService: AssetUpdateService,
    private readonly sourceUpdateService: SourceUpdateService,
  ) {}

  async run(): Promise<void> {
    const config = this.getConfig();
    this.logger.log(`Loading reserve data from ${config.repoUrl}`);

    const http = axios.create({ timeout: config.requestTimeoutMs });
    const [rawAssets, rawSources] = await Promise.all([
      fetchJson<unknown>(http, config.rawAssetsUrl),
      fetchJson<unknown>(http, config.rawSourcesUrl),
    ]);

    await this.assetUpdateService.syncFromRemote(rawAssets);
    await this.sourceUpdateService.syncFromRemote(rawSources);

    this.logger.log('Data update completed.');
  }

  private getConfig(): ReserveSourcesConfig {
    const config = this.configService.get<ReserveSourcesConfig>('reserveSources');
    if (!config) {
      throw new Error('reserveSources config is missing');
    }
    return config;
  }
}
