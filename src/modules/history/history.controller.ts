import { ApiOperation } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get, Query, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import Redis from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';

import { HistoryService } from './history.service';
import { HistoryResponse } from './response/history.response';
import { PaginationDto } from './dto/pagination.dto';
import { PaginationRequest } from './request/pagination.request';
import { RevenueHistoryResponse } from './response/revenue-history.response';
import { RevenueHistoryFullResponse } from './response/revenue-history-full.response';
import { HistoryFullResponse } from './response/history-full.response';
import { OffsetRequest } from './request/offset.request';
import { OffsetDto } from './dto/offset.dto';

import { ApiPaginatedResponse } from '@app/common/swagger/api-paginated-response.decorator';
import { PaginatedDataResponse } from '@app/common/response/paginated-data.response';
import { PaginationMetaResponse } from '@app/common/response/pagination-meta.response';
import { OffsetDataResponse } from '@app/common/response/offset-data.response';
import { OffsetMetaResponse } from '@app/common/response/offset-meta.response';
import { ApiOffsetResponse } from '@app/common/swagger/api-offset-response.decorator';
import { HOUR_IN_SEC } from '@app/common/constants';

@Injectable()
@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

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
    const key = `history:v2:treasury:${request.limit ?? 'null'}:${request.offset ?? 0}:${request.order ?? 'DESC'}`;
    const ttl = HOUR_IN_SEC;

    const cached = await this.redisClient.get(key);
    if (cached) return JSON.parse(cached) as OffsetDataResponse<HistoryResponse>;

    const paginatedData = await this.historyService.getOffsetTreasuryHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    const res = new OffsetDataResponse<HistoryResponse>(
      paginatedData.data.map((history) => {
        return new HistoryResponse(history);
      }),
      new OffsetMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
    await this.redisClient.set(key, JSON.stringify(res), 'EX', ttl);
    return res;
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get revenue history reduced response' })
  @ApiOffsetResponse(RevenueHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/revenue')
  async getRevenueHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<RevenueHistoryResponse>> {
    const key = `history:v2:revenue:${request.limit ?? 'null'}:${request.offset ?? 0}:${request.order ?? 'DESC'}`;
    const ttl = HOUR_IN_SEC;

    const cached = await this.redisClient.get(key);
    if (cached) return JSON.parse(cached) as OffsetDataResponse<RevenueHistoryResponse>;

    const paginatedData = await this.historyService.getOffsetRevenueHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    const res = new OffsetDataResponse<RevenueHistoryResponse>(
      paginatedData.data.map((history) => {
        return new RevenueHistoryResponse(history);
      }),
      new OffsetMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
    await this.redisClient.set(key, JSON.stringify(res), 'EX', ttl);
    return res;
  }
}
