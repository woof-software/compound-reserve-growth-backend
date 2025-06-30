import { ApiProperty } from '@nestjs/swagger';

import { Asset } from 'modules/asset/asset.entity';

export class AssetResponse {
  @ApiProperty({ example: 2 })
  public id: number;

  @ApiProperty({ example: '0xdef456' })
  public address: string;

  @ApiProperty({ example: 18 })
  public decimals: number;

  @ApiProperty({ example: 'DAI' })
  public symbol: string;

  @ApiProperty({ example: 'ethereum' })
  public network: string;

  @ApiProperty({ example: 'ERC20' })
  public type: string;

  constructor(asset: Asset) {
    this.id = asset.id;
    this.address = asset.address;
    this.decimals = asset.decimals;
    this.symbol = asset.symbol;
    this.network = asset.network;
    this.type = asset.type;
  }
}
