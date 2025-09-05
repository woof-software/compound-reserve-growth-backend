import { ApiOperation } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HistoryService } from './history.service';
import { HistoryResponse } from './response/history.response';
import { PaginationDto } from './dto/pagination.dto';
import { PaginationRequest } from './request/pagination.request';
import { RevenueHistoryResponse } from './response/revenue-history.response';
import { RevenueHistoryFullResponse } from './response/revenue-history-full.response';
import { StatsHistoryResponse } from './response/stats-history.response';
import { HistoryFullResponse } from './response/history-full.response';
import { OffsetRequest } from './request/offset.request';
import { OffsetDto } from './dto/offset.dto';

import { ApiPaginatedResponse } from '@app/common/swagger/api-paginated-response.decorator';
import { PaginatedDataResponse } from '@app/common/response/paginated-data.response';
import { PaginationMetaResponse } from '@app/common/response/pagination-meta.response';
import { OffsetDataResponse } from '@app/common/response/offset-data.response';
import { OffsetnMetaResponse } from '@app/common/response/offset-meta.response';
import { ApiOffsetResponse } from '@app/common/swagger/api-offset-response.decorator';

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
  @ApiOffsetResponse(HistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/treasury')
  async getTreasuryHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<HistoryResponse>> {
    const paginatedData = await this.historyService.getOffsetTreasuryHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    return new OffsetDataResponse<HistoryResponse>(
      paginatedData.data.map((history) => {
        return new HistoryResponse(history);
      }),
      new OffsetnMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get revenue history reduced response' })
  @ApiOffsetResponse(RevenueHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/revenue')
  async getRevenueHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<RevenueHistoryResponse>> {
    const paginatedData = await this.historyService.getOffsetRevenueHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    return new OffsetDataResponse<RevenueHistoryResponse>(
      paginatedData.data.map((history) => {
        return new RevenueHistoryResponse(history);
      }),
      new OffsetnMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get statistics on FE' })
  @ApiOffsetResponse(StatsHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('/stats')
  async getStatsHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<StatsHistoryResponse>> {
    const paginatedData = await this.historyService.getOffsetStatsHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    return new OffsetDataResponse<StatsHistoryResponse>(
      paginatedData.data.map((data) => {
        return new StatsHistoryResponse(data);
      }),
      new OffsetnMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
  }
}
