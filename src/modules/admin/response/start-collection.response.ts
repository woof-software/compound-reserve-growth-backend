import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class StartCollectionResponse {
  @ApiProperty({
    description: 'flag',
    example: false,
    type: 'boolean',
    required: false,
  })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  enableFlag?: boolean = false;

  @ApiProperty({
    description: 'data',
    example: '2025-07-28 12:55:20',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @ValidateIf((o) => o.enableFlag === true && o.data !== undefined)
  @IsDate()
  data?: Date;
}
