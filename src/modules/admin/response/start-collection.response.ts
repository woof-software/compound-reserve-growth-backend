import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class StartCollectionResponse {
  @ApiProperty({
    description: 'flag for clearing data from databases ',
    example: false,
    type: 'boolean',
    required: false,
  })
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  @IsBoolean()
  clearData?: boolean = false;

  @ApiProperty({
    description: 'collection start date',
    example: '2025-05-01',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @ValidateIf((o) => o.enableFlag === true && o.data !== undefined)
  @IsDate()
  data?: Date;
}
