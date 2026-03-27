import { ApiProperty } from '@nestjs/swagger';

import { RevenueEntity } from 'modules/revenue/revenue.entity';
import { SourceFullResponse } from 'modules/source/response/source-full.response';

export class RevenueHistoryFullResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: 1750809600 })
  public date: number;

  @ApiProperty({ type: SourceFullResponse })
  public source: SourceFullResponse;

  constructor(revenue: RevenueEntity) {
    this.id = revenue.id;
    this.value = revenue.value;
    this.date = new Date(revenue.date).getTime() / 1000;
    this.source = new SourceFullResponse(revenue.source);
  }
}
