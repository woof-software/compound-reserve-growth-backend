import { ApiProperty } from '@nestjs/swagger';

import { AssetRole } from '@/modules/history/enum/comet-reserve-type.enum';
import { CometReserveHistoryItem } from '@/modules/history/types/comet-reserve-history-item.type';

export class CometReserveHistoryResponse {
  @ApiProperty({ example: 1, description: 'Source chain ID' })
  public chainId: number;

  @ApiProperty({ example: '0xc3d688b66703497daa19211eedff47f25384cdc3' })
  public marketAddress: string;

  @ApiProperty({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  public assetAddress: string;

  @ApiProperty({ example: AssetRole.BASE, enum: AssetRole })
  public assetRole: AssetRole;

  @ApiProperty({ example: '10008879' })
  public quantity: string;

  @ApiProperty({ example: 1.05, description: 'Reserve price in USD' })
  public price: number;

  @ApiProperty({ example: 105.525, description: 'Reserve value in USD' })
  public value: number;

  @ApiProperty({ example: 1750809600, description: 'Reserve timestamp in seconds since epoch' })
  public timestamp: number;

  @ApiProperty({ example: 20123456, description: 'Reserve block number' })
  public blockNumber: number;

  constructor(item: CometReserveHistoryItem) {
    this.chainId = item.chainId;
    this.marketAddress = item.marketAddress;
    this.assetAddress = item.assetAddress;
    this.assetRole = item.assetRole;
    this.quantity = item.quantity;
    this.price = item.price;
    this.value = item.value;
    this.timestamp = item.timestamp;
    this.blockNumber = item.blockNumber;
  }
}
