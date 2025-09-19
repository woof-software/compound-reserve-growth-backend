import { ApiProperty } from '@nestjs/swagger';

import { LiquidationEvent } from 'modules/history/entities';

export class LiquidationEventResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({
    example: '0x95e0a34e85d0a7ac3cf2016fa4dad9ea517ce44e7c64390946c71d51917a1f10',
    description: 'txHash - transaction hash',
  })
  public txHash: string;

  @ApiProperty({
    example: '0x5a13D329A193ca3B1fE2d7B459097EdDba14C28F',
    description: 'liquidator - address of the liquidator',
  })
  public liquidator: string;

  @ApiProperty({
    example: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    description: 'tokenAddress - collateral token address',
  })
  public tokenAddress: string;

  @ApiProperty({
    example: '0xd0c7101eacbb49f3decccc166d238410d6d46d57',
    description: 'priceFeed - price feed contract address',
    nullable: true,
  })
  public priceFeed: string | null;

  @ApiProperty({ example: '212.00685936', description: 'earnings - earnings in USD' })
  public earnings: string;

  @ApiProperty({ example: 101191280, description: 'blockNumber - block number of the transaction' })
  public blockNumber: number;

  @ApiProperty({ example: 1686774766, description: 'date - date in seconds since epoch' })
  public d: number;

  @ApiProperty({
    example: 59,
    description: 'sourceId - ID of the source that generated this liquidation event',
  })
  public sId: number;

  constructor(liquidationEvent: LiquidationEvent) {
    this.id = liquidationEvent.id;
    this.txHash = liquidationEvent.txHash;
    this.liquidator = liquidationEvent.liquidator;
    this.tokenAddress = liquidationEvent.tokenAddress;
    this.priceFeed = liquidationEvent.priceFeed;
    this.earnings = liquidationEvent.earnings;
    this.blockNumber = liquidationEvent.blockNumber;
    this.d = new Date(liquidationEvent.date).getTime() / 1000;
    this.sId = liquidationEvent.source.id;
  }
}
