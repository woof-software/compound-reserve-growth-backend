import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyAggregationRequest {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ description: 'Source ID', example: 1, required: false })
  sourceId?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ description: 'Asset ID', example: 1, required: false })
  assetId?: number;
}
