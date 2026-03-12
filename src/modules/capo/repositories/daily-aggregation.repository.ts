import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DailyAggregation } from 'modules/capo/entities/daily.entity';
import { Snapshot } from 'modules/capo/entities/snapshot.entity';

import { Order } from '@app/common/enum/order.enum';

export interface DailyAggregationListItem {
  entity: DailyAggregation;
  lastPrice?: number | string;
}

export interface DailyAggregationStatsRow {
  oracleAddress: string;
  oracleName: string;
  chainId: number;
  avgRatio: string;
  minRatio: string;
  maxRatio: string;
  avgPrice: string;
  minPrice: string;
  maxPrice: string;
  cappedCount: number | string | null;
  totalCount: number | string | null;
}

@Injectable()
export class DailyAggregationRepository {
  constructor(
    @InjectRepository(DailyAggregation)
    private readonly repository: Repository<DailyAggregation>,
  ) {}

  create(data: Partial<DailyAggregation>): DailyAggregation {
    return this.repository.create(data);
  }

  async save(aggregation: DailyAggregation): Promise<DailyAggregation> {
    return this.repository.save(aggregation);
  }

  async findByOracleAndDate(oracleAddress: string, date: Date): Promise<DailyAggregation | null> {
    return this.repository.findOne({
      where: {
        oracleAddress,
        date,
      },
    });
  }

  async listWithLastPrice(params: {
    offset: number;
    limit: number | null;
    order: Order;
    assetId?: number;
  }): Promise<{ items: DailyAggregationListItem[]; total: number }> {
    const { offset, limit, order, assetId } = params;

    const qb = this.repository
      .createQueryBuilder('agg')
      .addSelect(
        (sub) =>
          sub
            .select('s.price')
            .from(Snapshot, 's')
            .where('s.oracleAddress = agg.oracleAddress')
            .andWhere('s.chainId = agg.chainId')
            .andWhere('s.timestamp >= (agg.date::timestamp)')
            .andWhere(`s.timestamp <  (agg.date::timestamp + interval '1 day')`)
            .orderBy('s.timestamp', 'DESC')
            .limit(1),
        'lastPrice',
      );

    if (assetId !== undefined) {
      qb.andWhere('agg.assetId = :assetId', { assetId });
    }

    const total = await qb.getCount();

    qb.orderBy('agg.date', order).offset(offset);
    if (limit !== null) {
      qb.limit(limit);
    }

    const { entities, raw } = await qb.getRawAndEntities();

    return {
      items: entities.map((entity, index) => ({
        entity,
        lastPrice: raw[index]?.lastPrice,
      })),
      total,
    };
  }

  async getStatsForRange(startDate: Date, endDate: Date): Promise<DailyAggregationStatsRow[]> {
    return this.repository.manager
      .createQueryBuilder()
      .from(Snapshot, 'snapshot')
      .select([
        'snapshot.oracleAddress as "oracleAddress"',
        'snapshot.oracleName as "oracleName"',
        'snapshot.chainId as "chainId"',
        'AVG(snapshot.ratio) as "avgRatio"',
        'MIN(snapshot.ratio) as "minRatio"',
        'MAX(snapshot.ratio) as "maxRatio"',
        'AVG(snapshot.price) as "avgPrice"',
        'MIN(snapshot.price) as "minPrice"',
        'MAX(snapshot.price) as "maxPrice"',
        'COUNT(CASE WHEN snapshot.isCapped = true THEN 1 END) as "cappedCount"',
        'COUNT(*) as "totalCount"',
      ])
      .where('snapshot.timestamp >= :startDate', { startDate })
      .andWhere('snapshot.timestamp < :endDate', { endDate })
      .andWhere('snapshot.ratio IS NOT NULL')
      .andWhere('snapshot.price IS NOT NULL')
      .groupBy('snapshot.oracleAddress')
      .addGroupBy('snapshot.oracleName')
      .addGroupBy('snapshot.chainId')
      .having('COUNT(*) > 0')
      .orderBy('snapshot.oracleAddress', 'ASC')
      .getRawMany<DailyAggregationStatsRow>();
  }
}
