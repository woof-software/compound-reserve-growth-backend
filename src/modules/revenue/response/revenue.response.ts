import { ApiProperty } from '@nestjs/swagger';

import { RevenueEntity } from '@/modules/revenue/revenue.entity';
import { SourceResponse } from '@/modules/source/response/source.response';

export class RevenueResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ type: SourceResponse })
  public source: SourceResponse;

  @ApiProperty({ example: 501 })
  public reserveId: number;

  @ApiProperty({ example: 20123456 })
  public blockNumber: number;

  @ApiProperty({ example: '10008879' })
  public quantityDelta: string;

  @ApiProperty({ example: 1.05 })
  public price: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public date: Date;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  @ApiProperty({ example: '2025-06-17T12:30:00Z' })
  public updatedAt: Date;

  constructor(revenue: RevenueEntity) {
    this.id = revenue.id;
    this.source = new SourceResponse(revenue.source);
    this.reserveId = revenue.reserveId;
    this.blockNumber = revenue.blockNumber;
    this.quantityDelta = revenue.quantityDelta;
    this.price = revenue.price;
    this.value = revenue.value;
    this.date = revenue.date;
    this.createdAt = revenue.createdAt;
    this.updatedAt = revenue.updatedAt;
  }
}
