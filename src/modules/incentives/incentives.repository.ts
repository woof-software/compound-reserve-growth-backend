import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { IncentiveEntity } from './incentive.entity';
import { IncentiveProjectionRow } from './types/incentive-projection-row.type';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';
import { Order } from '@/common/enum/order.enum';

type IncentiveProjectionRowRaw = {
  reserveId: number | null;
  spendId: number | null;
  sourceId: number | null;
  date: string | null;
  incomes: number | null;
  rewardsSupply: number | null;
  rewardsBorrow: number | null;
  priceComp: number | null;
};

@Injectable()
export class IncentivesRepository {
  constructor(
    @InjectRepository(IncentiveEntity)
    private readonly incentivesRepository: Repository<IncentiveEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentiveEntity>> {
    const order = dto.order ?? Order.DESC;
    const offset = dto.offset ?? 0;
    const query = this.incentivesRepository
      .createQueryBuilder('incentive')
      .innerJoinAndSelect('incentive.source', 'source')
      .where('source.deletedAt IS NULL')
      .orderBy('incentive.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('incentive.id', 'ASC')
      .offset(offset);

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const [items, total] = await query.getManyAndCount();

    return new OffsetDataDto<IncentiveEntity>(items, dto.limit ?? null, offset, total);
  }

  public async inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    try {
      await qr.startTransaction('READ COMMITTED');
      const result = await work(qr.manager);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      try {
        await qr.rollbackTransaction();
      } catch (rollbackErr) {
        if (err instanceof Error && rollbackErr instanceof Error) {
          (err as Error & { cause?: unknown }).cause = rollbackErr;
        }
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  public async buildProjectionRows(manager: EntityManager): Promise<IncentiveProjectionRow[]> {
    const algorithmsArrayLiteral = `{${[
      Algorithm.COMET_STATS,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ].join(',')}}`;

    const rawRows = (await manager.query(
      `
        WITH "filtered_sources" AS (
          SELECT s."id", s."assetId"
          FROM "source" s
          WHERE s."deletedAt" IS NULL
            AND s."algorithm" && $1::text[]
        ),
        "latest_spends" AS (
          SELECT DISTINCT ON (s."sourceId", s."date"::date)
            s."id" AS "spendId",
            s."sourceId" AS "sourceId",
            s."date" AS "date",
            s."date"::date AS "day",
            s."valueSupply" AS "valueSupply",
            s."valueBorrow" AS "valueBorrow",
            s."priceComp" AS "priceComp"
          FROM "spends" s
          INNER JOIN "filtered_sources" fs ON fs."id" = s."sourceId"
          ORDER BY
            s."sourceId" ASC,
            s."date"::date ASC,
            s."createdAt" DESC,
            s."id" DESC
        ),
        "latest_comp_prices" AS (
          SELECT DISTINCT ON (p."date"::date)
            p."date"::date AS "day",
            p."price" AS "priceComp"
          FROM "price" p
          WHERE p."symbol" = 'COMP'
          ORDER BY
            p."date"::date ASC,
            p."createdAt" DESC,
            p."id" DESC
        ),
        "daily_reserves" AS (
          SELECT DISTINCT ON (r."sourceId", r."date")
            r."id" AS "reserveId",
            r."sourceId" AS "sourceId",
            r."date" AS "date",
            r."date"::date AS "day",
            r."price" AS "price",
            r."value" AS "value",
            r."quantity"::numeric AS "quantity",
            a."decimals" AS "decimals"
          FROM "reserves" r
          INNER JOIN "filtered_sources" fs ON fs."id" = r."sourceId"
          INNER JOIN "asset" a ON a."id" = fs."assetId"
          ORDER BY
            r."sourceId" ASC,
            r."date" ASC,
            r."blockNumber" DESC,
            r."id" DESC
        ),
        "reserve_rows" AS (
          SELECT
            dr."reserveId" AS "reserveId",
            dr."sourceId" AS "sourceId",
            dr."date" AS "date",
            dr."day" AS "day",
            dr."price" AS "price",
            dr."value" AS "value",
            dr."quantity" AS "quantity",
            dr."decimals" AS "decimals",
            LAG(dr."quantity") OVER (
              PARTITION BY dr."sourceId"
              ORDER BY dr."date" ASC, dr."reserveId" ASC
            ) AS "previousQuantity"
          FROM "daily_reserves" dr
        ),
        "base_rows" AS (
          SELECT
            rr."reserveId" AS "reserveId",
            ls."spendId" AS "spendId",
            rr."sourceId" AS "sourceId",
            rr."date" AS "date",
            CASE
              WHEN rr."previousQuantity" IS NULL THEN rr."value"::double precision
              ELSE (
                ((rr."quantity" - rr."previousQuantity") / POWER(10::numeric, rr."decimals"))::double precision
                * rr."price"
              )
            END AS "incomes",
            COALESCE(ls."valueSupply", 0)::double precision AS "rewardsSupply",
            COALESCE(ls."valueBorrow", 0)::double precision AS "rewardsBorrow",
            COALESCE(NULLIF(ls."priceComp", 0), cp."priceComp", 0)::double precision AS "priceComp"
          FROM "reserve_rows" rr
          LEFT JOIN "latest_spends" ls
            ON ls."sourceId" = rr."sourceId"
            AND ls."day" = rr."day"
          LEFT JOIN "latest_comp_prices" cp
            ON cp."day" = rr."day"
        ),
        "spends_only_rows" AS (
          SELECT
            NULL::int AS "reserveId",
            ls."spendId" AS "spendId",
            ls."sourceId" AS "sourceId",
            ls."date" AS "date",
            0::double precision AS "incomes",
            COALESCE(ls."valueSupply", 0)::double precision AS "rewardsSupply",
            COALESCE(ls."valueBorrow", 0)::double precision AS "rewardsBorrow",
            COALESCE(NULLIF(ls."priceComp", 0), cp."priceComp", 0)::double precision AS "priceComp"
          FROM "latest_spends" ls
          LEFT JOIN "latest_comp_prices" cp
            ON cp."day" = ls."day"
          WHERE NOT EXISTS (
            SELECT 1
            FROM "reserve_rows" rr
            WHERE rr."sourceId" = ls."sourceId"
              AND rr."day" = ls."day"
          )
        ),
        "merged_rows" AS (
          SELECT
            "reserveId",
            "spendId",
            "sourceId",
            "date",
            "incomes",
            "rewardsSupply",
            "rewardsBorrow",
            "priceComp"
          FROM "base_rows"
          UNION ALL
          SELECT
            "reserveId",
            "spendId",
            "sourceId",
            "date",
            "incomes",
            "rewardsSupply",
            "rewardsBorrow",
            "priceComp"
          FROM "spends_only_rows"
        )
        SELECT
          mr."reserveId",
          mr."spendId",
          mr."sourceId",
          mr."date",
          mr."incomes",
          mr."rewardsSupply",
          mr."rewardsBorrow",
          mr."priceComp"
        FROM "merged_rows" mr
        ORDER BY
          mr."date" ASC,
          mr."sourceId" ASC,
          mr."reserveId" ASC NULLS LAST,
          mr."spendId" ASC NULLS LAST
      `,
      [algorithmsArrayLiteral],
    )) as IncentiveProjectionRowRaw[];

    return rawRows
      .filter((row) => row.sourceId !== null && row.date !== null)
      .map(
        (row): IncentiveProjectionRow => ({
          reserveId: row.reserveId === null ? null : Number(row.reserveId),
          spendId: row.spendId === null ? null : Number(row.spendId),
          sourceId: Number(row.sourceId),
          date: new Date(row.date),
          incomes: Number(row.incomes ?? 0),
          rewardsSupply: Number(row.rewardsSupply ?? 0),
          rewardsBorrow: Number(row.rewardsBorrow ?? 0),
          priceComp: Number(row.priceComp ?? 0),
        }),
      );
  }

  public async replaceAll(rows: IncentiveProjectionRow[], manager: EntityManager): Promise<number> {
    await manager.query(`TRUNCATE TABLE "incentives" RESTART IDENTITY`);

    if (!rows.length) {
      return 0;
    }

    const now = new Date();
    const insertedCountByBatch: number[] = [];

    for (const chunk of this.chunkRows(rows, 500)) {
      const result = (await manager.query(
        `
          INSERT INTO "incentives" (
            "sourceId",
            "reserveId",
            "spendId",
            "date",
            "incomes",
            "rewardsSupply",
            "rewardsBorrow",
            "priceComp",
            "createdAt",
            "updatedAt"
          )
          VALUES ${this.buildValuesClause(chunk.length, 10)}
          RETURNING "id"
        `,
        chunk.flatMap((row) => [
          row.sourceId,
          row.reserveId,
          row.spendId,
          row.date,
          row.incomes,
          row.rewardsSupply,
          row.rewardsBorrow,
          row.priceComp,
          now,
          now,
        ]),
      )) as Array<{ id: number }>;

      insertedCountByBatch.push(result.length);
    }

    return insertedCountByBatch.reduce((sum, count) => sum + count, 0);
  }

  private chunkRows(rows: IncentiveProjectionRow[], size: number): IncentiveProjectionRow[][] {
    const chunks: IncentiveProjectionRow[][] = [];

    for (let i = 0; i < rows.length; i += size) {
      chunks.push(rows.slice(i, i + size));
    }

    return chunks;
  }

  private buildValuesClause(rowCount: number, columnCount: number): string {
    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const start = rowIndex * columnCount;
      const placeholders = Array.from(
        { length: columnCount },
        (_, columnIndex) => `$${start + columnIndex + 1}`,
      );

      return `(${placeholders.join(', ')})`;
    }).join(', ');
  }
}
