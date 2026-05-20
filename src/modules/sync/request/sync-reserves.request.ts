import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import {
  DEFAULT_SYNC_RESERVES_LIMIT,
  MAX_SYNC_RESERVES_CURSOR_LENGTH,
  MAX_SYNC_RESERVES_LIMIT,
} from '@/config/sync.config';
import { IsSyncReservesCursor } from '@/modules/sync/validators/is-sync-reserves-cursor.validator';

export class SyncReservesRequest {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_SYNC_RESERVES_LIMIT,
    default: DEFAULT_SYNC_RESERVES_LIMIT,
    description: 'Maximum number of reserve rows to return.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SYNC_RESERVES_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor from the previous response lastItemCursor value.',
    example: '2026-04-07T00:00:00.000Z-501',
    maxLength: MAX_SYNC_RESERVES_CURSOR_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SYNC_RESERVES_CURSOR_LENGTH)
  @IsSyncReservesCursor()
  readonly cursor?: string;
}
