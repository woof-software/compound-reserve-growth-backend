import { ApiProperty } from '@nestjs/swagger';

import { Source } from 'modules/source/source.entity';

export class SourceResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: '0xabc123' })
  public address: string;

  @ApiProperty({ example: 'mainnet' })
  public network: string;

  @ApiProperty({ example: 'cUSDCv3', nullable: true })
  public market: string;

  @ApiProperty({ example: 'subgraph' })
  public algorithm: string;

  @ApiProperty({ example: 19876543 })
  public blockNumber: number;

  @ApiProperty({ example: '2025-06-17T12:00:00Z' })
  public createdAt: Date;

  @ApiProperty({ example: '2025-06-17T12:30:00Z', nullable: true })
  public checkedAt: Date;

  constructor(source: Source) {
    this.id = source.id;
    this.address = source.address;
    this.network = source.network;
    this.market = source.market;
    this.algorithm = source.algorithm;
    this.blockNumber = source.blockNumber;
    this.createdAt = source.createdAt;
    this.checkedAt = source.checkedAt;
  }
}
