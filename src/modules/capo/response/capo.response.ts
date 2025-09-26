import { ApiProperty } from '@nestjs/swagger';

export class CapoResponse {
  @ApiProperty({ description: 'Oracle address', example: '0x1234567890abcdef' })
  oa: string;

  @ApiProperty({ description: 'Oracle name', example: 'Example Oracle' })
  on: string;

  @ApiProperty({ description: 'Date of aggregation (timestamp, seconds)', example: '1758240000' })
  d: number;

  @ApiProperty({ description: 'Cap value', example: '555.555' })
  cp: string;

  @ApiProperty({ description: 'Last price, USD', example: '505.505' })
  lp: string;

  @ApiProperty({ description: 'Asset ID', example: 1, nullable: true })
  aId: number | null;
}
