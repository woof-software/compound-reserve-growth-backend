import { ApiOperation } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HistoryService } from './history.service';
import { HistoryResponse } from './response/history.response';
import { PaginationDto } from './dto/pagination.dto';
import { PaginationRequest } from './request/pagination.request';
import { RevenueHistoryResponse } from './response/revenue-history.response';
import { RevenueHistoryFullResponse } from './response/revenue-history-full.response';
import { HistoryFullResponse } from './response/history-full.response';

import { ApiPaginatedResponse } from '@app/common/swagger/api-paginated-response.decorator';
import { PaginatedDataResponse } from '@app/common/response/paginated-data.response';
import { PaginationMetaResponse } from '@app/common/response/pagination-meta.response';

@Injectable()
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get treasury history full response' })
  @ApiPaginatedResponse(HistoryFullResponse)
  @HttpCode(HttpStatus.OK)
  @Get('treasury')
  async getTreasuryHistoryFull(
    @Query() request: PaginationRequest,
  ): Promise<PaginatedDataResponse<HistoryFullResponse>> {
    const paginatedData = await this.historyService.getPaginatedTreasuryHistory(
      new PaginationDto(request?.page, request?.perPage, request?.order),
    );
    return new PaginatedDataResponse<HistoryFullResponse>(
      paginatedData.data.map((history) => {
        return new HistoryFullResponse(history);
      }),
      new PaginationMetaResponse(paginatedData.page, paginatedData.perPage, paginatedData.total),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get revenue history full response' })
  @ApiPaginatedResponse(RevenueHistoryFullResponse)
  @HttpCode(HttpStatus.OK)
  @Get('revenue')
  async getRevenueHistoryFull(
    @Query() request: PaginationRequest,
  ): Promise<PaginatedDataResponse<RevenueHistoryFullResponse>> {
    const paginatedData = await this.historyService.getPaginatedRevenueHistory(
      new PaginationDto(request?.page, request?.perPage, request?.order),
    );
    const paginatedResponse = new PaginatedDataResponse<RevenueHistoryFullResponse>(
      paginatedData.data.map((history) => {
        return new RevenueHistoryFullResponse(history);
      }),
      new PaginationMetaResponse(paginatedData.page, paginatedData.perPage, paginatedData.total),
    );
    return paginatedResponse;
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get treasury history reduced response' })
  @ApiPaginatedResponse(HistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/treasury')
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
  @ApiOperation({ summary: 'Get revenue history reduced response' })
  @ApiPaginatedResponse(RevenueHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/revenue')
  async getRevenueHistory(
    @Query() request: PaginationRequest,
  ): Promise<PaginatedDataResponse<RevenueHistoryResponse>> {
    const paginatedData = await this.historyService.getPaginatedRevenueHistory(
      new PaginationDto(request?.page, request?.perPage, request?.order),
    );
    const paginatedResponse = new PaginatedDataResponse<RevenueHistoryResponse>(
      paginatedData.data.map((history) => {
        return new RevenueHistoryResponse(history);
      }),
      new PaginationMetaResponse(paginatedData.page, paginatedData.perPage, paginatedData.total),
    );
    return paginatedResponse;
  }
}
