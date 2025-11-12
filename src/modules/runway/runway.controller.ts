import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { RunwayResponse } from './response/runway.response';
import { RunwayService } from './runway.service';

import { ApiKeyEndpoint } from '@/common/decorators';

@Injectable()
@Controller('runway')
export class RunwayController {
  constructor(private readonly runwayService: RunwayService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get runway data' })
  @ApiResponse({ type: [RunwayResponse] })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getRunwayData(): Promise<RunwayResponse[]> {
    return this.runwayService.getData();
  }
}
