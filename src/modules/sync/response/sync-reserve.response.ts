import { ApiProperty } from '@nestjs/swagger';

import { SyncReserveAssetRole } from '@/modules/sync/enum/sync-reserve-asset-role.enum';
import { SyncReserveItem } from '@/modules/sync/types/sync-reserve-item.type';

export class SyncReserveResponse {
  @ApiProperty({ example: 1, description: 'Source chain ID' })
  public chainId: number;

  @ApiProperty({ example: '0xc3d688b66703497daa19211eedff47f25384cdc3' })
  public marketAddress: string;

  @ApiProperty({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  public assetAddress: string;

  @ApiProperty({ example: 'USDC' })
  public assetSymbol: string;

  @ApiProperty({ example: 6 })
  public assetDecimals: number;

  @ApiProperty({ example: SyncReserveAssetRole.BASE, enum: SyncReserveAssetRole })
  public assetRole: SyncReserveAssetRole;

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

  @ApiProperty({
    example: '2026-04-07T00:00:00.000Z',
    description: 'Reserve row update timestamp used for sync pagination.',
  })
  public updatedAt: string;

  constructor(item: SyncReserveItem) {
    this.chainId = item.chainId;
    this.marketAddress = item.marketAddress;
    this.assetAddress = item.assetAddress;
    this.assetSymbol = item.assetSymbol;
    this.assetDecimals = item.assetDecimals;
    this.assetRole = item.assetRole;
    this.quantity = item.quantity;
    this.price = item.price;
    this.value = item.value;
    this.timestamp = item.timestamp;
    this.blockNumber = item.blockNumber;
    this.updatedAt = item.updatedAt.toISOString();
  }
}
