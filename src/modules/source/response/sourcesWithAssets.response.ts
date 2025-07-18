import { ApiProperty } from '@nestjs/swagger';

import { AssetResponse } from 'modules/asset/response/asset.response';

import { SourceResponse } from './source.response';

export class SourcesWithAssetsResponse {
  @ApiProperty({ type: [SourceResponse] })
  public sources: SourceResponse[];

  @ApiProperty({ type: [AssetResponse] })
  public assets: AssetResponse[];

  constructor(sources: SourceResponse[], assets: AssetResponse[]) {
    this.sources = sources;
    this.assets = assets;
  }
}
