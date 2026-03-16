import { Injectable } from '@nestjs/common';

import { AssetService } from 'modules/asset/asset.service';
import { AssetResponse } from 'modules/asset/response/asset.response';

import { Algorithm } from 'common/enum/algorithm.enum';

import { SourceRepository } from './source.repository';
import { SourceEntity } from './source.entity';
import { SourcesWithAssetsResponse } from './response/sourcesWithAssets.response';
import { SourceResponse } from './response/source.response';

@Injectable()
export class SourceService {
  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly assetService: AssetService,
  ) {}
  async listAll(): Promise<SourceEntity[]> {
    return this.sourceRepository.list();
  }

  async listSourcesWithAssets(): Promise<SourcesWithAssetsResponse> {
    const [sources, assets] = await Promise.all([
      this.sourceRepository.list(),
      this.assetService.listAll(),
    ]);
    return {
      sources: sources.map((source) => new SourceResponse(source)),
      assets: assets.map((asset) => new AssetResponse(asset)),
    };
  }

  async listByAlgorithms(algorithms: Algorithm[]): Promise<SourceEntity[]> {
    return this.sourceRepository.listByAlgorithms(algorithms);
  }
}
