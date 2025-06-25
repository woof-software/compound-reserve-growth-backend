import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';
import { SourceResponse } from 'modules/source/response/source.response';

export class HistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ type: SourceResponse })
  public source: SourceResponse;

  @ApiProperty({ example: 20123456 })
  public blockNumber: number;

  @ApiProperty({ example: '10008879' })
  public quantity: string;

  @ApiProperty({ example: 1.05 })
  public price: number;

  @ApiProperty({ example: 105.525 })
  public value: number;

  @ApiProperty({ example: 1750809600 })
  public date: number;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  constructor(history: History) {
    this.id = history.id;
    this.source = new SourceResponse(history.source);
    this.blockNumber = history.blockNumber;
    this.quantity = history.quantity;
    this.price = history.price;
    this.value = history.value;
    this.date = new Date(history.date).getTime() / 1000;
    this.createdAt = history.createdAt;
  }
}
