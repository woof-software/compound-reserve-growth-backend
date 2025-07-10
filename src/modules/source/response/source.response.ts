import { ApiProperty } from '@nestjs/swagger';

import { Source } from 'modules/source/source.entity';
import { SourceType } from 'modules/source/enum/source-type.enum';
import { AssetType } from 'modules/asset/enum/asset-type.enum';

export class SourceResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: '0xabc123' })
  public address: string;

  @ApiProperty({ example: 'mainnet' })
  public network: string;

  @ApiProperty({ example: SourceType.MARKET_V3 })
  public type: string;

  @ApiProperty({ example: 'cUSDCv3', nullable: true })
  public market: string;

  @ApiProperty({ example: 12 })
  public assetId: number;

  @ApiProperty({ example: AssetType.ETH_CORRELATED })
  public assetType: string;

  constructor(source: Source) {
    this.id = source.id;
    this.address = source.address;
    this.network = source.network;
    this.type = source.type;
    this.market = source.market;
    this.assetId = source.asset.id;
    this.assetType = source.asset.type;
  }
}
