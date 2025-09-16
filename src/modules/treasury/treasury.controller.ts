import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HistoryService } from 'modules/history/history.service';
import { ReserveResponse } from 'modules/history/response/reserve.response';

@Injectable()
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly historyService: HistoryService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get treasury holdings' })
  @ApiResponse({ type: [ReserveResponse] })
  @HttpCode(HttpStatus.OK)
  @Get('holdings')
  async getTreasuryHistory(): Promise<ReserveResponse[]> {
    const response = await this.historyService.getTreasuryHoldings();
    return response.map((history) => new ReserveResponse(history));
  }
}
