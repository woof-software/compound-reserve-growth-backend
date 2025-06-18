import { ApiProperty } from '@nestjs/swagger';

import { Treasury } from 'modules/treasury/treasury.entity';

export class TreasuryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 1 })
  public sourceId: number;

  @ApiProperty({ example: 2 })
  public assetId: number;

  @ApiProperty({ example: 20123456 })
  public blockNumber: number;

  @ApiProperty({ example: '10008879' })
  public quantity: string;

  @ApiProperty({ example: 1.05 })
  public price: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public date: Date;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  constructor(treasury: Treasury) {
    this.id = treasury.id;
    this.sourceId = treasury.source.id;
    this.assetId = treasury.asset.id;
    this.blockNumber = treasury.blockNumber;
    this.quantity = treasury.quantity;
    this.price = treasury.price;
    this.value = treasury.value;
    this.createdAt = treasury.createdAt;
  }
}
