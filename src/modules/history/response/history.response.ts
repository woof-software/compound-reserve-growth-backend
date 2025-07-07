import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';

export class HistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: '10008879' })
  public q: string; // quantity of tokens

  @ApiProperty({ example: 1.05 })
  public p: number; // price in USD

  @ApiProperty({ example: 105.525 })
  public v: number; // value in USD

  @ApiProperty({ example: 1750809600 })
  public d: number; // date in seconds

  @ApiProperty({ example: 23 })
  public sId: number; // source ID

  constructor(history: History) {
    this.id = history.id;
    this.q = history.quantity;
    this.p = history.price;
    this.v = history.value;
    this.d = new Date(history.date).getTime() / 1000;
    this.sId = history.source.id;
  }
}
