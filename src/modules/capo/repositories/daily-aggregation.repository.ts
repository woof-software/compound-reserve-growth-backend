import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DailyAggregation } from 'modules/capo/entities/daily.entity';
import { Snapshot } from 'modules/capo/entities/snapshot.entity';

import { Order } from '@/common/enum/order.enum';

export interface DailyAggregationListItem {
  entity: DailyAggregation;
  lastPrice?: number | string;
}

export interface ReplaceDailyAggregationResult {
  candidateCount: number;
  savedCount: number;
  skippedMissingAssetCount: number;
}

@Injectable()
export class DailyAggregationRepository {
  constructor(
    @InjectRepository(DailyAggregation)
    private readonly repository: Repository<DailyAggregation>,
  ) {}

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

  async replaceForRange(params: {
    startDate: Date;
    endDate: Date;
    currentTimestamp: number;
  }): Promise<ReplaceDailyAggregationResult> {
    const { startDate, endDate, currentTimestamp } = params;

    return this.repository.manager.transaction(async (manager) => {
      const deleteQuery = `
        DELETE FROM "daily_aggregation"
        WHERE "date" = $1::date
          AND EXISTS (
            SELECT 1
            FROM "oracle_snapshots" snapshot
            WHERE snapshot."timestamp" >= $1
              AND snapshot."timestamp" < $2
              AND snapshot."ratio" IS NOT NULL
              AND snapshot."price" IS NOT NULL
          )
      `;

      await manager.query(deleteQuery, [startDate, endDate]);

      const insertQuery = `
        WITH "stats" AS (
          SELECT
            snapshot."oracleAddress" AS "oracleAddress",
            snapshot."oracleName" AS "oracleName",
            snapshot."chainId" AS "chainId",
            AVG(snapshot."ratio") AS "avgRatio",
            MIN(snapshot."ratio") AS "minRatio",
            MAX(snapshot."ratio") AS "maxRatio",
            AVG(snapshot."price") AS "avgPrice",
            MIN(snapshot."price") AS "minPrice",
            MAX(snapshot."price") AS "maxPrice",
            COUNT(CASE WHEN snapshot."isCapped" = true THEN 1 END) AS "cappedCount",
            COUNT(*) AS "totalCount"
          FROM "oracle_snapshots" snapshot
          WHERE snapshot."timestamp" >= $1
            AND snapshot."timestamp" < $2
            AND snapshot."ratio" IS NOT NULL
            AND snapshot."price" IS NOT NULL
          GROUP BY
            snapshot."oracleAddress",
            snapshot."oracleName",
            snapshot."chainId"
          HAVING COUNT(*) > 0
        ),
        "latest_snapshots" AS (
          SELECT DISTINCT ON (snapshot."oracleAddress")
            snapshot."oracleAddress" AS "oracleAddress",
            snapshot."ratio" AS "ratio",
            snapshot."price" AS "price",
            snapshot."snapshotRatio" AS "snapshotRatio",
            snapshot."snapshotTimestamp" AS "snapshotTimestamp",
            snapshot."maxYearlyGrowthPercent" AS "maxYearlyGrowthPercent"
          FROM "oracle_snapshots" snapshot
          WHERE snapshot."timestamp" >= $1
            AND snapshot."timestamp" < $2
          ORDER BY
            snapshot."oracleAddress" ASC,
            snapshot."timestamp" DESC,
            snapshot."id" DESC
        ),
        "prepared_rows" AS (
          SELECT
            stats."oracleAddress" AS "oracleAddress",
            stats."oracleName" AS "oracleName",
            stats."chainId" AS "chainId",
            $1::date AS "date",
            stats."avgRatio" AS "avgRatio",
            stats."minRatio" AS "minRatio",
            stats."maxRatio" AS "maxRatio",
            stats."avgPrice" AS "avgPrice",
            stats."minPrice" AS "minPrice",
            stats."maxPrice" AS "maxPrice",
            stats."cappedCount" AS "cappedCount",
            stats."totalCount" AS "totalCount",
            oracle."assetId" AS "assetId",
            CASE
              WHEN oracle."assetId" IS NULL
                OR latest."ratio" IS NULL
                OR latest."price" IS NULL
                OR latest."snapshotRatio" IS NULL
                OR latest."snapshotTimestamp" IS NULL
                OR latest."maxYearlyGrowthPercent" IS NULL
              THEN NULL
              WHEN latest."ratio"::numeric <= 0
                OR latest."price"::numeric <= 0
              THEN NULL
              ELSE (
                (
                  latest."snapshotRatio"::numeric
                  + FLOOR(
                    FLOOR(
                      latest."snapshotRatio"::numeric
                      * latest."maxYearlyGrowthPercent"::numeric
                      * 10000000000::numeric
                      / 10000::numeric
                      / 31536000::numeric
                    )
                    * GREATEST(0::numeric, $3::numeric - latest."snapshotTimestamp"::numeric)
                    / 10000000000::numeric
                  )
                ) / latest."ratio"::numeric
              ) * latest."price"::numeric
            END AS "cap"
          FROM "stats" stats
          LEFT JOIN "latest_snapshots" latest
            ON latest."oracleAddress" = stats."oracleAddress"
          LEFT JOIN "oracles" oracle
            ON oracle."address" = stats."oracleAddress"
        ),
        "inserted" AS (
          INSERT INTO "daily_aggregation" (
            "oracleAddress",
            "oracleName",
            "chainId",
            "date",
            "avgRatio",
            "minRatio",
            "maxRatio",
            "avgPrice",
            "minPrice",
            "maxPrice",
            "cap",
            "cappedCount",
            "totalCount",
            "assetId"
          )
          SELECT
            "oracleAddress",
            "oracleName",
            "chainId",
            "date",
            "avgRatio",
            "minRatio",
            "maxRatio",
            "avgPrice",
            "minPrice",
            "maxPrice",
            "cap",
            "cappedCount",
            "totalCount",
            "assetId"
          FROM "prepared_rows"
          WHERE "assetId" IS NOT NULL
          RETURNING 1
        )
        SELECT
          (SELECT COUNT(*)::int FROM "stats") AS "candidateCount",
          (SELECT COUNT(*)::int FROM "inserted") AS "savedCount",
          (SELECT COUNT(*)::int FROM "prepared_rows" WHERE "assetId" IS NULL) AS "skippedMissingAssetCount"
      `;

      const [row] = (await manager.query(insertQuery, [
        startDate,
        endDate,
        currentTimestamp,
      ])) as Array<{
        candidateCount: number | string;
        savedCount: number | string;
        skippedMissingAssetCount: number | string;
      }>;

      return {
        candidateCount: Number(row?.candidateCount ?? 0),
        savedCount: Number(row?.savedCount ?? 0),
        skippedMissingAssetCount: Number(row?.skippedMissingAssetCount ?? 0),
      };
    });
  }
}
