import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';
import { SourceResponse } from 'modules/source/response/source.response';

export class RevenueHistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: 1750809600 })
  public date: number;

  @ApiProperty({ type: SourceResponse })
  public source: SourceResponse;

  constructor(history: History) {
    this.id = history.id;
    this.value = history.value;
    this.date = new Date(history.date).getTime() / 1000;
    this.source = new SourceResponse(history.source);
  }
}
