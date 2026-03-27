import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

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

  async rebuildAll(): Promise<number> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    const algorithmsArrayLiteral = `{${[
      Algorithm.COMET,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ].join(',')}}`;

    try {
      await qr.startTransaction('READ COMMITTED');
      await qr.query(`TRUNCATE TABLE "revenue" RESTART IDENTITY`);

      await qr.query(
        `
          WITH "filtered_sources" AS (
            SELECT s."id", s."assetId"
            FROM "source" s
            WHERE s."deletedAt" IS NULL
              AND s."algorithm" && $1::text[]
          ),
          "reserve_rows" AS (
            SELECT
              r."id" AS "reserveId",
              r."sourceId" AS "sourceId",
              r."blockNumber" AS "blockNumber",
              r."date" AS "date",
              r."price" AS "price",
              r."quantity"::numeric AS "quantity",
              a."decimals" AS "decimals",
              LAG(r."quantity"::numeric) OVER (
                PARTITION BY r."sourceId"
                ORDER BY r."date" ASC, r."id" ASC
              ) AS "previousQuantity"
            FROM "reserves" r
            INNER JOIN "filtered_sources" fs ON fs."id" = r."sourceId"
            INNER JOIN "asset" a ON a."id" = fs."assetId"
          )
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
            rr."date",
            NOW(),
            NOW()
          FROM "reserve_rows" rr
        `,
        [algorithmsArrayLiteral],
      );

      const countRows = (await qr.query(
        `SELECT COUNT(*)::int AS "count" FROM "revenue"`,
      )) as Array<{ count: number }>;

      await qr.commitTransaction();
      return Number(countRows[0]?.count ?? 0);
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
