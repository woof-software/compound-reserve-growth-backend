import { ApiProperty } from '@nestjs/swagger';

export class DailyAggregationResponse {
  @ApiProperty({ description: 'Oracle address', example: '0x1234567890abcdef' })
  oa: string;

  @ApiProperty({ description: 'Oracle name', example: 'Example Oracle' })
  on: string;

  @ApiProperty({ description: 'Chain ID', example: 1 })
  cId: number;

  @ApiProperty({ description: 'Date of aggregation (timestamp, ms)', example: '1758279602196' })
  d: number;

  @ApiProperty({ description: 'Average ratio', example: '1000000000000000000' })
  ar: string;

  @ApiProperty({ description: 'Minimum ratio', example: '900000000000000000' })
  mr: string;

  @ApiProperty({ description: 'Maximum ratio', example: '1100000000000000000' })
  xr: string;

  @ApiProperty({ description: 'Cap value', example: '1200000000000000000' })
  cp: string;

  @ApiProperty({ description: 'Average price', example: '2000000000' })
  ap: string;

  @ApiProperty({ description: 'Minimum price', example: '1800000000' })
  mp: string;

  @ApiProperty({ description: 'Maximum price', example: '2200000000' })
  xp: string;

  @ApiProperty({ description: 'Count of capped entries', example: 50 })
  cc: number;

  @ApiProperty({ description: 'Total count of entries', example: 100 })
  tc: number;
  @ApiProperty({ description: 'Source ID', example: 1, nullable: true })
  sId: number | null;

  @ApiProperty({ description: 'Asset ID', example: 1, nullable: true })
  aId: number | null;
}
