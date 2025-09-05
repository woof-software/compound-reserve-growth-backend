import { ApiProperty } from '@nestjs/swagger';

import { Reserve } from 'modules/history/entity';

export class HistoryResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({
    example: '10008879',
    description: 'quantity - quantity of tokens in string format',
  })
  public q: string;

  @ApiProperty({ example: 1.05, description: 'price - price in USD' })
  public p: number;

  @ApiProperty({ example: 105.525, description: 'value - value in USD' })
  public v: number;

  @ApiProperty({ example: 1750809600, description: 'date - date in seconds since epoch' })
  public d: number;

  @ApiProperty({
    example: 23,
    description: 'sourceId - ID of the source that generated this history entry',
  })
  public sId: number;

  constructor(reserve: Reserve) {
    this.id = reserve.id;
    this.q = reserve.quantity;
    this.p = reserve.price;
    this.v = reserve.value;
    this.d = new Date(reserve.date).getTime() / 1000;
    this.sId = reserve.source.id;
  }
}
