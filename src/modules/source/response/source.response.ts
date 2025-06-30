import { ApiProperty } from '@nestjs/swagger';

import { AssetResponse } from 'modules/asset/response/asset.response';
import { Source } from 'modules/source/source.entity';

export class SourceResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: '0xabc123' })
  public address: string;

  @ApiProperty({ example: 'mainnet' })
  public network: string;

  @ApiProperty({ example: 'cUSDCv3', nullable: true })
  public market: string;

  @ApiProperty({ type: AssetResponse })
  public asset: AssetResponse;

  constructor(source: Source) {
    this.id = source.id;
    this.address = source.address;
    this.network = source.network;
    this.market = source.market;
    this.asset = new AssetResponse(source.asset);
  }
}
