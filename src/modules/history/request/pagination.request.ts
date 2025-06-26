import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Order } from 'common/enum/order.enum';

export abstract class PaginationRequest {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly perPage?: number;

  @ApiPropertyOptional({ enum: Order, default: Order.DESC })
  @IsOptional()
  @IsEnum(Order)
  readonly order?: Order = Order.DESC;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly search?: string;
}
