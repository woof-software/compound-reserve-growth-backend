import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class StartReservesDto {
  @ApiProperty({
    description: 'Enable flag for additional processing',
    example: false,
    required: false,
    default: false,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  enableFlag?: boolean = false;

  @ApiProperty({
    description: 'Optional parameter that depends on the flag. Only used when enableFlag is true',
    example: 'custom-value',
    required: false,
    type: 'string',
  })
  @IsOptional()
  @IsString()
  optionalParam?: string;
}
