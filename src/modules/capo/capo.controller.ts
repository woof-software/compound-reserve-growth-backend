import { Controller, Injectable, Get, Query, HttpStatus, HttpCode } from '@nestjs/common';

import { CapoService } from './capo.service';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DailyAggregationResponse } from './response/daily.response';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get daily CAPO aggragetion' })
  @ApiQuery({ name: 'sourceAddress', required: false, description: 'Source contract address' })
  @ApiQuery({ name: 'assetId', required: false, description: 'Asset ID (number)' })
  @ApiResponse({ type: [DailyAggregationResponse] })
  @HttpCode(HttpStatus.OK)
  @Get('daily')
  async getDailyAggregations(@Query('sourceAddress') sourceAddress?: string, @Query('assetId') assetId?: number): Promise<DailyAggregationResponse[]> {
    return this.capoService.listDailyAggregations({sourceAddress, assetId});
  }
}
