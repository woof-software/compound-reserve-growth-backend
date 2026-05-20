import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartCollectionRequest {
  @ApiPropertyOptional({
    description: 'Whether to clear existing history before collection starts.',
    example: false,
    type: Boolean,
  })
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  @IsBoolean()
  clearData?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Collection start timestamp in ISO 8601 format. The field name remains `data` for backward compatibility.',
    example: '2025-05-01',
    type: String,
    format: 'date-time',
  })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @ValidateIf((o) => o.clearData === true && o.data !== undefined)
  @IsDate()
  data?: Date;
}
