import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';

export class RevenueHistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 105.525 })
  public v: number;

  @ApiProperty({ example: 1750809600 })
  public d: number;

  @ApiProperty({ example: 12 })
  public sId: number;

  constructor(history: History) {
    this.id = history.id;
    this.v = history.value;
    this.d = new Date(history.date).getTime() / 1000;
    this.sId = history.source.id;
  }
}
