import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HistoryService } from 'modules/history/history.service';
import { HistoryResponse } from 'modules/history/response/history.response';

@Injectable()
@Controller('trasury')
export class TreasuryController {
  constructor(private readonly historyService: HistoryService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get treasury holdings' })
  @ApiResponse({ type: [HistoryResponse] })
  @HttpCode(HttpStatus.OK)
  @Get('holdings')
  async getTreasuryHistory(): Promise<HistoryResponse[]> {
    const response = await this.historyService.getTreasuryHoldings();
    return response.map((history) => new HistoryResponse(history));
  }
}
