import { ApiProperty } from '@nestjs/swagger';

import { Revenue } from 'modules/revenue/revenue.entity';

export class RevenueResponse {
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

  constructor(revenue: Revenue) {
    this.id = revenue.id;
    this.sourceId = revenue.source.id;
    this.assetId = revenue.asset.id;
    this.blockNumber = revenue.blockNumber;
    this.quantity = revenue.quantity;
    this.price = revenue.price;
    this.value = revenue.value;
    this.date = revenue.date;
    this.createdAt = revenue.createdAt;
  }
}
