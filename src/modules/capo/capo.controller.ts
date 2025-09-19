import { Controller, Injectable, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { DailyAggregationResponse } from './response/daily.response';
import { DailyAggregationRequest } from './request/daily.request';
import { CapoService } from './capo.service';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get CAPO aggregations (plain list)' })
  @ApiOkResponse({ type: [DailyAggregationResponse] })
  @HttpCode(HttpStatus.OK)
  @Get()
  async list(@Query() request: DailyAggregationRequest): Promise<DailyAggregationResponse[]> {
    return this.capoService.listDailyAggregations(request);
  }
}
