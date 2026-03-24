import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartCollectionRequest {
  @ApiProperty({
    description: 'Flag for clearing data from databases',
    example: false,
    type: 'boolean',
    required: false,
  })
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  @IsBoolean()
  clearData?: boolean = false;

  @ApiProperty({
    description: 'Collection start date',
    example: '2025-05-01',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @ValidateIf((o) => o.clearData === true && o.data !== undefined)
  @IsDate()
  data?: Date;
}
