import { Controller, Injectable, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { CapoResponse } from './response/capo.response';
import { CapoRequest } from './request/capo.request';
import { CapoQueryService } from './capo-query.service';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoQueryService: CapoQueryService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get CAPO aggregations (plain list)' })
  @ApiOkResponse({ type: [CapoResponse] })
  @HttpCode(HttpStatus.OK)
  @Get()
  async list(@Query() request: CapoRequest): Promise<OffsetDataDto<CapoResponse>> {
    return this.capoQueryService.getAggregations(request);
  }
}
