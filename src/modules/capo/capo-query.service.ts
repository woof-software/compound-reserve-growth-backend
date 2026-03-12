import { Injectable, Logger } from '@nestjs/common';

import { OffsetRequest } from 'modules/history/request/offset.request';

import { DailyAggregation } from './entities/daily.entity';
import { DailyAggregationRepository } from './repositories/daily-aggregation.repository';
import { CapoResponse } from './response/capo.response';

import { Order } from '@app/common/enum/order.enum';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';

@Injectable()
export class CapoQueryService {
  private readonly logger = new Logger(CapoQueryService.name);

  constructor(private readonly aggregationRepository: DailyAggregationRepository) {}

  async getAggregations(
    dto: OffsetRequest & { assetId?: number },
  ): Promise<OffsetDataDto<CapoResponse>> {
    const { offset = 0, limit = null, order = Order.DESC, assetId } = dto;

    const { items, total } = await this.aggregationRepository.listWithLastPrice({
      offset,
      limit,
      order,
      assetId,
    });

    if (items.length === 0) {
      this.logger.log('No daily aggregations found for the given parameters');
      return new OffsetDataDto<CapoResponse>([], limit, offset, 0);
    }

    return new OffsetDataDto<CapoResponse>(
      items.map((item) => this.toResponse(item.entity, item.lastPrice)),
      limit,
      offset,
      total,
    );
  }

  private toResponse(entity: DailyAggregation, lastPrice?: number | string): CapoResponse {
    const normalizeDate = (date: string | Date) => {
      const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
      return Math.floor(timestamp / 1000);
    };

    return {
      oa: entity.oracleAddress,
      on: entity.oracleName,
      d: normalizeDate(entity.date),
      cp: entity.cap,
      lp: String(lastPrice),
      aId: entity.assetId,
    };
  }
}
