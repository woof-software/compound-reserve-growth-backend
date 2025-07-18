import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';
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

  constructor(history: History) {
    this.id = history.id;
    this.value = history.value;
    this.date = new Date(history.date).getTime() / 1000;
    this.source = new SourceFullResponse(history.source);
  }
}
