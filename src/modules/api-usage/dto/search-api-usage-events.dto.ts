import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { HttpMethod } from '@/common/enum/http-method.enum';
import { Order } from '@/common/enum/order.enum';

export class SearchApiUsageEventsDto {
  @ApiPropertyOptional({
    description: 'Sort events by creation date',
    enum: Order,
    default: Order.DESC,
  })
  @IsOptional()
  @IsEnum(Order)
  order?: Order;

  @ApiPropertyOptional({ description: 'Filter by API key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Filter by client name (partial match)' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Filter by HTTP method', enum: HttpMethod })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;
}
