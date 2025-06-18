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
  public chain: string;

  @ApiProperty({ example: 'ERC20' })
  public type: string;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  constructor(asset: Asset) {
    this.id = asset.id;
    this.address = asset.address;
    this.decimals = asset.decimals;
    this.symbol = asset.symbol;
    this.chain = asset.chain;
    this.type = asset.type;
    this.createdAt = asset.createdAt;
  }
}
