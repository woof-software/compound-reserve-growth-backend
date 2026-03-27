import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';
import { PaginationDto } from 'modules/history/dto/pagination.dto';

import { RevenueEntity } from './revenue.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';
import { Order } from '@/common/enum/order.enum';

@Injectable()
export class RevenueRepository {
  constructor(
    @InjectRepository(RevenueEntity) private readonly revenueRepository: Repository<RevenueEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listAll(): Promise<RevenueEntity[]> {
    return this.createRevenueQuery(true)
      .orderBy('revenue.date', 'DESC')
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC')
      .getMany();
  }

  async findById(id: number): Promise<RevenueEntity | null> {
    return this.createRevenueQuery(true).where('revenue.id = :id', { id }).getOne();
  }

  async getPaginatedHistory(dto: PaginationDto): Promise<PaginatedDataDto<RevenueEntity>> {
    const order = dto.order ?? Order.DESC;
    const page = dto.page ?? 1;
    const query = this.createRevenueQuery(true)
      .orderBy('revenue.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC');

    if (dto.perPage) {
      query.skip((page - 1) * dto.perPage).take(dto.perPage);
    }

    const [items, total] = await query.getManyAndCount();

    return new PaginatedDataDto<RevenueEntity>(items, page, dto.perPage ?? total, total);
  }

  async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<RevenueEntity>> {
    const order = dto.order ?? Order.DESC;
    const offset = dto.offset ?? 0;
    const query = this.createRevenueQuery(false)
      .orderBy('revenue.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC')
      .offset(offset);

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const [items, total] = await query.getManyAndCount();

    return new OffsetDataDto<RevenueEntity>(items, dto.limit ?? null, offset, total);
  }

  async syncHistory(clearData = false): Promise<{
    deletedCount: number;
    insertedCount: number;
  }> {
    const revenueAlgorithms = `{${[
      Algorithm.COMET,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ].join(',')}}`;

    return this.inTransaction(async (manager) => {
      const staleDeletedCount = clearData
        ? await this.clearAll(manager)
        : await this.deleteStaleHistory(revenueAlgorithms, manager);
      const { deletedCount: rebuiltTailDeletedCount, insertedCount } =
        await this.insertMissingHistory(revenueAlgorithms, manager);

      return {
        deletedCount: staleDeletedCount + rebuiltTailDeletedCount,
        insertedCount,
      };
    });
  }

  async inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
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

  private async clearAll(manager: EntityManager): Promise<number> {
    const countRows = (await manager.query(
      `
        SELECT COUNT(*)::int AS "count"
        FROM "revenue"
      `,
    )) as Array<{ count: number }>;
    const deletedCount = Number(countRows[0]?.count ?? 0);

    await manager.query(`TRUNCATE TABLE "revenue" RESTART IDENTITY`);

    return deletedCount;
  }

  private async deleteStaleHistory(
    algorithmsArrayLiteral: string,
    manager: EntityManager,
  ): Promise<number> {
    const deletedRows = (await manager.query(
      `
        DELETE FROM "revenue" r
        USING "source" s
        WHERE s."id" = r."sourceId"
          AND (
            s."deletedAt" IS NOT NULL
            OR NOT (s."algorithm" && $1::text[])
          )
        RETURNING r."id"
      `,
      [algorithmsArrayLiteral],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  private async insertMissingHistory(
    algorithmsArrayLiteral: string,
    manager: EntityManager,
  ): Promise<{
    deletedCount: number;
    insertedCount: number;
  }> {
    const result = (await manager.query(
      `
        WITH "filtered_sources" AS (
          SELECT s."id", s."assetId"
          FROM "source" s
          WHERE s."deletedAt" IS NULL
            AND s."algorithm" && $1::text[]
        ),
        "source_checkpoints" AS (
          SELECT DISTINCT ON (r."sourceId")
            r."sourceId" AS "sourceId",
            r."date" AS "checkpointDate"
          FROM "revenue" r
          INNER JOIN "filtered_sources" fs ON fs."id" = r."sourceId"
          ORDER BY
            r."sourceId" ASC,
            r."date" DESC,
            r."reserveId" DESC
        ),
        "deleted_rows" AS (
          DELETE FROM "revenue" rv
          USING "source_checkpoints" sc
          WHERE rv."sourceId" = sc."sourceId"
            AND rv."date" >= sc."checkpointDate"
          RETURNING rv."id"
        ),
        "daily_reserves" AS (
          SELECT DISTINCT ON (r."sourceId", r."date")
            r."id" AS "reserveId",
            r."sourceId" AS "sourceId",
            r."blockNumber" AS "blockNumber",
            r."date" AS "date",
            r."price" AS "price",
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
        "lookback_reserves" AS (
          SELECT DISTINCT ON (dr."sourceId")
            dr."reserveId",
            dr."sourceId",
            dr."blockNumber",
            dr."date",
            dr."price",
            dr."quantity",
            dr."decimals",
            TRUE AS "isLookback"
          FROM "daily_reserves" dr
          INNER JOIN "source_checkpoints" sc ON sc."sourceId" = dr."sourceId"
          WHERE dr."date" < sc."checkpointDate"
          ORDER BY
            dr."sourceId" ASC,
            dr."date" DESC,
            dr."reserveId" DESC
        ),
        "candidate_reserves" AS (
          SELECT
            dr."reserveId",
            dr."sourceId",
            dr."blockNumber",
            dr."date",
            dr."price",
            dr."quantity",
            dr."decimals",
            FALSE AS "isLookback"
          FROM "daily_reserves" dr
          LEFT JOIN "source_checkpoints" sc ON sc."sourceId" = dr."sourceId"
          WHERE sc."checkpointDate" IS NULL
            OR dr."date" >= sc."checkpointDate"
          UNION ALL
          SELECT
            lr."reserveId",
            lr."sourceId",
            lr."blockNumber",
            lr."date",
            lr."price",
            lr."quantity",
            lr."decimals",
            lr."isLookback"
          FROM "lookback_reserves" lr
        ),
        "reserve_rows" AS (
          SELECT
            cr."reserveId",
            cr."sourceId",
            cr."blockNumber",
            cr."date",
            cr."price",
            cr."quantity",
            cr."decimals",
            cr."isLookback",
            LAG(cr."quantity") OVER (
              PARTITION BY cr."sourceId"
              ORDER BY cr."date" ASC, cr."reserveId" ASC
            ) AS "previousQuantity"
          FROM "candidate_reserves" cr
        ),
        "insert_rows" AS (
          SELECT
            rr."reserveId",
            rr."sourceId",
            rr."blockNumber",
            (rr."quantity" - COALESCE(rr."previousQuantity", 0))::numeric AS "quantityDelta",
            rr."price",
            (
              (
                (rr."quantity" - COALESCE(rr."previousQuantity", 0))
                / POWER(10::numeric, rr."decimals")
              )::double precision
              * rr."price"
            ) AS "value",
            rr."date"
          FROM "reserve_rows" rr
          WHERE rr."isLookback" = FALSE
        ),
        "inserted_rows" AS (
          INSERT INTO "revenue" (
            "reserveId",
            "sourceId",
            "blockNumber",
            "quantityDelta",
            "price",
            "value",
            "date",
            "createdAt",
            "updatedAt"
          )
          SELECT
            ir."reserveId",
            ir."sourceId",
            ir."blockNumber",
            ir."quantityDelta",
            ir."price",
            ir."value",
            ir."date",
            NOW(),
            NOW()
          FROM "insert_rows" ir
          ORDER BY
            ir."date" ASC,
            ir."sourceId" ASC,
            ir."reserveId" ASC
          ON CONFLICT ("reserveId") DO NOTHING
          RETURNING "id"
        )
        SELECT
          COALESCE((SELECT COUNT(*)::int FROM "deleted_rows"), 0) AS "deletedCount",
          COALESCE((SELECT COUNT(*)::int FROM "inserted_rows"), 0) AS "insertedCount"
      `,
      [algorithmsArrayLiteral],
    )) as Array<{ deletedCount: number; insertedCount: number }>;

    return {
      deletedCount: Number(result[0]?.deletedCount ?? 0),
      insertedCount: Number(result[0]?.insertedCount ?? 0),
    };
  }

  private createRevenueQuery(withAsset: boolean): SelectQueryBuilder<RevenueEntity> {
    const query = this.revenueRepository
      .createQueryBuilder('revenue')
      .innerJoinAndSelect('revenue.source', 'source')
      .where('source.deletedAt IS NULL');

    if (withAsset) {
      query.innerJoinAndSelect('source.asset', 'asset');
    }

    return query;
  }
}
