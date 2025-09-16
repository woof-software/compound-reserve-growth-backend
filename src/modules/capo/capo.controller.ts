import { Controller, Injectable, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { OffsetRequest } from 'modules/history/request/offset.request';

import { PaginationRequest } from 'common/request/pagination.request';

import { DailyAggregationResponse } from './response/daily.response';
import { DailyAggregationRequest } from './request/daily.request';
import { CapoService } from './capo.service';

import { ApiPaginatedResponse } from '@app/common/swagger/api-paginated-response.decorator';
import { ApiOffsetResponse } from '@app/common/swagger/api-offset-response.decorator';
import { PaginatedDataResponse } from '@app/common/response/paginated-data.response';
import { PaginationMetaResponse } from '@app/common/response/pagination-meta.response';
import { OffsetDataResponse } from '@app/common/response/offset-data.response';
import { OffsetnMetaResponse } from '@app/common/response/offset-meta.response';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get daily CAPO aggregations (plain list)' })
  @ApiOkResponse({ type: [DailyAggregationResponse] })
  @HttpCode(HttpStatus.OK)
  @Get('daily')
  async getDailyPlain(
    @Query() request: DailyAggregationRequest,
  ): Promise<DailyAggregationResponse[]> {
    return this.capoService.listDailyAggregations({ ...request });
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get daily CAPO aggregations (paginated)' })
  @ApiPaginatedResponse(DailyAggregationResponse)
  @HttpCode(HttpStatus.OK)
  @Get('daily/paginated')
  async getDailyPaginated(
    @Query() request: PaginationRequest & DailyAggregationRequest,
  ): Promise<PaginatedDataResponse<DailyAggregationResponse>> {
    const paginated = await this.capoService.getPaginatedDailyAggregations({ ...request });
    return new PaginatedDataResponse<DailyAggregationResponse>(
      paginated.data,
      new PaginationMetaResponse(paginated.page, paginated.perPage, paginated.total),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @ApiOperation({ summary: 'Get daily CAPO aggregations (offset/limit)' })
  @ApiOffsetResponse(DailyAggregationResponse)
  @HttpCode(HttpStatus.OK)
  @Get('daily/offset')
  async getDailyOffset(
    @Query() request: OffsetRequest & DailyAggregationRequest,
  ): Promise<OffsetDataResponse<DailyAggregationResponse>> {
    const offsetData = await this.capoService.getOffsetDailyAggregations({ ...request });
    return new OffsetDataResponse<DailyAggregationResponse>(
      offsetData.data,
      new OffsetnMetaResponse(offsetData.limit, offsetData.offset, offsetData.total),
    );
  }
}
