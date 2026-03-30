import { ApiProperty } from '@nestjs/swagger';

import { CometReserveType } from 'modules/history/enum/comet-reserve-type.enum';
import { CometReserveHistoryItem } from 'modules/history/types/comet-reserve-history-item.type';

export class CometReserveHistoryResponse {
  @ApiProperty({ example: '0xc3d688b66703497daa19211eedff47f25384cdc3' })
  public sourceAddress: string;

  @ApiProperty({ example: '10008879' })
  public quantity: string;

  @ApiProperty({ example: 105.525, description: 'Reserve value in USD' })
  public value: number;

  @ApiProperty({ example: 1.05, description: 'Reserve price in USD' })
  public price: number;

  @ApiProperty({ example: 1, nullable: true, description: 'Source chain ID' })
  public chainId: number | null;

  @ApiProperty({ example: 1750809600, description: 'Reserve timestamp in seconds since epoch' })
  public timestamp: number;

  @ApiProperty({ example: 20123456, description: 'Reserve block number' })
  public blockNumber: number;

  @ApiProperty({ example: CometReserveType.MARKET, enum: CometReserveType })
  public reserveType: CometReserveType;

  constructor(item: CometReserveHistoryItem) {
    this.sourceAddress = item.sourceAddress;
    this.quantity = item.quantity;
    this.value = item.value;
    this.price = item.price;
    this.chainId = item.chainId;
    this.timestamp = item.timestamp;
    this.blockNumber = item.blockNumber;
    this.reserveType = item.reserveType;
  }
}
