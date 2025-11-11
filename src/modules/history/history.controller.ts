import { ApiOperation } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get, Query, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import Redis from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';
import { IncentiveHistoryResponse } from 'modules/history/response/incentives-history.response';
import { ApiKeyEndpoint } from 'modules/api-key/decorators/api-key-endpoint';

import { HistoryService } from './history.service';
import { ReserveResponse } from './response/reserve.response';
import { RevenueHistoryResponse } from './response/revenue-history.response';
import { StatsHistoryResponse } from './response/stats-history.response';
import { OffsetRequest } from './request/offset.request';
import { OffsetDto } from './dto/offset.dto';

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
  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get treasury history reduced response' })
  @ApiOffsetResponse(ReserveResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/treasury')
  async getTreasuryHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<ReserveResponse>> {
    const key = `history:v2:treasury:${request.limit ?? 'null'}:${request.offset ?? 0}:${request.order ?? 'DESC'}`;
    const ttl = HOUR_IN_SEC;

    const cached = await this.redisClient.get(key);
    if (cached) return JSON.parse(cached) as OffsetDataResponse<ReserveResponse>;

    const paginatedData = await this.historyService.getOffsetTreasuryHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    const res = new OffsetDataResponse<ReserveResponse>(
      paginatedData.data.map((reserve) => {
        return new ReserveResponse(reserve);
      }),
      new OffsetMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
    await this.redisClient.set(key, JSON.stringify(res), 'EX', ttl);
    return res;
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiKeyEndpoint()
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

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get statistics on FE' })
  @ApiOffsetResponse(StatsHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/stats')
  async getStatsHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<StatsHistoryResponse>> {
    const key = `history:v2:stats:${request.limit ?? 'null'}:${request.offset ?? 0}:${request.order ?? 'DESC'}`;
    const ttl = HOUR_IN_SEC;

    const cached = await this.redisClient.get(key);
    if (cached) return JSON.parse(cached) as OffsetDataResponse<StatsHistoryResponse>;

    const paginatedData = await this.historyService.getOffsetStatsHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    const res = new OffsetDataResponse<StatsHistoryResponse>(
      paginatedData.data.map((data) => {
        return new StatsHistoryResponse(data);
      }),
      new OffsetMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
    await this.redisClient.set(key, JSON.stringify(res), 'EX', ttl);
    return res;
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get incentives (incomes + spends) data' })
  @ApiOffsetResponse(IncentiveHistoryResponse)
  @HttpCode(HttpStatus.OK)
  @Get('v2/incentives')
  async getIncentivesHistory(
    @Query() request: OffsetRequest,
  ): Promise<OffsetDataResponse<IncentiveHistoryResponse>> {
    const key = `history:v2:incentives:${request.limit ?? 'null'}:${request.offset ?? 0}:${request.order ?? 'DESC'}`;
    const ttl = HOUR_IN_SEC;

    const cached = await this.redisClient.get(key);
    if (cached) return JSON.parse(cached) as OffsetDataResponse<IncentiveHistoryResponse>;

    const paginatedData = await this.historyService.getIncentiveHistory(
      new OffsetDto(request?.limit, request?.offset, request?.order),
    );
    const res = new OffsetDataResponse<IncentiveHistoryResponse>(
      paginatedData.data.map((d) => new IncentiveHistoryResponse(d)),
      new OffsetMetaResponse(paginatedData.limit, paginatedData.offset, paginatedData.total),
    );
    await this.redisClient.set(key, JSON.stringify(res), 'EX', ttl);
    return res;
  }
}
