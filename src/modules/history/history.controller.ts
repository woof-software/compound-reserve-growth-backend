import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HistoryService } from './history.service';
import { HistoryResponse } from './response/history.response';
import { PaginationDto } from './dto/pagination.dto';
import { PaginationRequest } from './request/pagination.request';

import { ApiPaginatedResponse } from '@app/common/swagger/api-paginated-response.decorator';
import { PaginatedDataResponse } from '@app/common/response/paginated-data.response';
import { PaginationMetaResponse } from '@app/common/response/pagination-meta.response';

@Injectable()
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get treasury history' })
  @ApiPaginatedResponse(HistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('treasury')
  async getTreasuryHistory(
    @Query() request: PaginationRequest,
  ): Promise<PaginatedDataResponse<HistoryResponse>> {
    const paginatedData = await this.historyService.getPaginatedTreasuryHistory(
      new PaginationDto(request?.page, request?.perPage, request?.order),
    );
    return new PaginatedDataResponse<HistoryResponse>(
      paginatedData.data.map((history) => {
        return new HistoryResponse(history);
      }),
      new PaginationMetaResponse(paginatedData.page, paginatedData.perPage, paginatedData.total),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get revenue history' })
  @ApiResponse({ status: HttpStatus.OK, type: [HistoryResponse] })
  @HttpCode(HttpStatus.OK)
  @Get('revenue')
  async getRevenueHistory(): Promise<HistoryResponse[]> {
    const response = await this.historyService.getRevenueHistory();
    return response.map((history) => new HistoryResponse(history));
  }
}
