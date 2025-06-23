import { ApiProperty } from '@nestjs/swagger';

import { SourceResponse } from 'modules/source/response/source.response';
import { Treasury } from 'modules/treasury/treasury.entity';

export class TreasuryResponse {
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

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public date: Date;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  constructor(treasury: Treasury) {
    this.id = treasury.id;
    this.source = new SourceResponse(treasury.source);
    this.blockNumber = treasury.blockNumber;
    this.quantity = treasury.quantity;
    this.price = treasury.price;
    this.value = treasury.value;
    this.createdAt = treasury.createdAt;
  }
}
