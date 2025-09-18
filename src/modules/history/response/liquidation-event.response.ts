import { ApiProperty } from '@nestjs/swagger';

import { LiquidationEvent } from 'modules/history/entities';

export class LiquidationEventResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 105.525, description: 'earnings - earnings in USD' })
  public earnings: number;

  @ApiProperty({ example: '0x1234...', description: 'liquidator - address of the liquidator' })
  public liquidator: string;

  @ApiProperty({ example: '0x5678...', description: 'tokenAddress - collateral token address' })
  public tokenAddress: string;

  @ApiProperty({
    example: '0x9abc...',
    description: 'priceFeed - price feed contract address',
    nullable: true,
  })
  public priceFeed: string | null;

  @ApiProperty({ example: 12345678, description: 'blockNumber - block number of the transaction' })
  public blockNumber: number;

  @ApiProperty({ example: '0xdef0...', description: 'txHash - transaction hash' })
  public txHash: string;

  @ApiProperty({ example: 1750809600, description: 'date - date in seconds since epoch' })
  public d: number;

  @ApiProperty({
    example: 12,
    description: 'sourceId - ID of the source that generated this liquidation event',
  })
  public sId: number;

  constructor(liquidationEvent: LiquidationEvent) {
    this.id = liquidationEvent.id;
    this.earnings = liquidationEvent.earnings;
    this.liquidator = liquidationEvent.liquidator;
    this.tokenAddress = liquidationEvent.tokenAddress;
    this.priceFeed = liquidationEvent.priceFeed;
    this.blockNumber = liquidationEvent.blockNumber;
    this.txHash = liquidationEvent.txHash;
    this.d = new Date(liquidationEvent.date).getTime() / 1000;
    this.sId = liquidationEvent.source.id;
  }
}
