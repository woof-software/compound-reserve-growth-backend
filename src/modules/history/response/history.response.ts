import { ApiProperty } from '@nestjs/swagger';

import { History } from 'modules/history/history.entity';

export class HistoryResponse {
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

  constructor(history: History) {
    this.id = history.id;
    this.sourceId = history.source.id;
    this.assetId = history.asset.id;
    this.blockNumber = history.blockNumber;
    this.quantity = history.quantity;
    this.price = history.price;
    this.value = history.value;
    this.date = history.date;
    this.createdAt = history.createdAt;
  }
}
