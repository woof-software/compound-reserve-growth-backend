import { ApiProperty } from '@nestjs/swagger';

import { Reserve } from 'modules/history/entities';
import { SourceFullResponse } from 'modules/source/response/source-full.response';

export class HistoryFullResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: '10008879' })
  public quantity: string;

  @ApiProperty({ example: 1.05 })
  public price: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: 1750809600 })
  public date: number;

  @ApiProperty({ type: SourceFullResponse })
  public source: SourceFullResponse;

  constructor(reserve: Reserve) {
    this.id = reserve.id;
    this.quantity = reserve.quantity;
    this.price = reserve.price;
    this.value = reserve.value;
    this.date = new Date(reserve.date).getTime() / 1000;
    this.source = new SourceFullResponse(reserve.source);
  }
}
