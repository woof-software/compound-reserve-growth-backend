import { ApiProperty } from '@nestjs/swagger';


export class DailyAggregationResponse {
  @ApiProperty({ description: 'Oracle address', example: '0x1234567890abcdef' })
  oracleAddress: string;

  @ApiProperty({ description: 'Oracle name', example: 'Example Oracle' })
  oracleName: string;

  @ApiProperty({ description: 'Chain ID', example: 1 })
  chainId: number;

  @ApiProperty({ description: 'Date of aggregation', example: '2024-02-02' })
  date: string;

  @ApiProperty({ description: 'Average ratio', example: '1000000000000000000' })
  avgRatio: string;

  @ApiProperty({ description: 'Minimum ratio', example: '900000000000000000' })
  minRatio: string;

  @ApiProperty({ description: 'Maximum ratio', example: '1100000000000000000' })
  maxRatio: string;

  @ApiProperty({ description: 'Cap value', example: '1200000000000000000' })
  cap: string;

  @ApiProperty({ description: 'Average price', example: '2000000000' })
  avgPrice: string;

  @ApiProperty({ description: 'Minimum price', example: '1800000000' })
  minPrice: string;

  @ApiProperty({ description: 'Maximum price', example: '2200000000' })
  maxPrice: string;

  @ApiProperty({ description: 'Count of capped entries', example: 50 })
  cappedCount: number;

  @ApiProperty({ description: 'Total count of entries', example: 100 })
  totalCount: number;

  @ApiProperty({ description: 'Source ID', example: 1, nullable: true })
  sourceId: number | null;

  @ApiProperty({ description: 'Asset ID', example: 1, nullable: true })
  assetId: number | null;
}
