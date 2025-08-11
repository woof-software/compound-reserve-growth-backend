import { Controller, Injectable, Get, Query, HttpStatus, HttpCode } from '@nestjs/common';

import { CapoService } from './capo.service';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DailyAggregation } from './daily.entity';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get daily CAPO aggragetion' })
  @ApiResponse({ type: [DailyAggregation] })
  @HttpCode(HttpStatus.OK)
  @Get('daily')
  async getDailyAggregations(@Query('oracle') oracle?: string) {
    return this.capoService.listDailyAggregations(oracle);
  }
}
