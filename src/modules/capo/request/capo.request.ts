import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

import { OffsetRequest } from 'modules/history/request/offset.request';

export class CapoRequest extends OffsetRequest {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ description: 'Asset ID', example: 1, required: false })
  assetId?: number;
}
