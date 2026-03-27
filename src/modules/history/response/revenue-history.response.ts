import { ApiProperty } from '@nestjs/swagger';

import { RevenueEntity } from 'modules/revenue/revenue.entity';

export class RevenueHistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 105.525, description: 'value - value in USD' })
  public v: number;

  @ApiProperty({ example: 1750809600, description: 'date - date in seconds since epoch' })
  public d: number;

  @ApiProperty({
    example: 12,
    description: 'sourceId - ID of the source that generated this reserve entry',
  })
  public sId: number;

  constructor(revenue: RevenueEntity) {
    this.id = revenue.id;
    this.v = revenue.value;
    this.d = new Date(revenue.date).getTime() / 1000;
    this.sId = revenue.source.id;
  }
}
