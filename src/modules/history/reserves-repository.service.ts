import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

import { IncentivesHistory, ReserveEntity } from './entities';
import { PaginationDto } from './dto/pagination.dto';
import { OffsetDto } from './dto/offset.dto';

import { Algorithm } from '@app/common/enum/algorithm.enum';
import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Order } from '@/common/enum/order.enum';

type IncentivesHistoryRaw = {
  sourceId: number | null;
  date: string | null;
  incomes: number | null;
  rewardsSupply: number | null;
  rewardsBorrow: number | null;
  priceComp: number | null;
  total: number;
};

@Injectable()
export class ReservesRepository {
  constructor(
    @InjectRepository(ReserveEntity) private readonly reservesRepository: Repository<ReserveEntity>,
  ) {}

  async save(reserve: ReserveEntity): Promise<ReserveEntity> {
    return this.reservesRepository.save(reserve);
  }

  async findById(id: number): Promise<ReserveEntity> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('reserves.id = :id', { id })
      .getOne();
  }

  async findLatestBySourceId(sourceId: number): Promise<ReserveEntity | null> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('source.id = :sourceId', { sourceId })
      .orderBy('reserves.blockNumber', 'DESC')
      .getOne();
  }

  async getTreasuryReserves(): Promise<ReserveEntity[]> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .orderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getTreasuryHoldings(): Promise<ReserveEntity[]> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .innerJoinAndSelect('reserves.source', 'source')
      .innerJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .distinctOn(['source.id', 'asset.id'])
      .orderBy('source.id', 'ASC')
      .addOrderBy('asset.id', 'ASC')
      .addOrderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getPaginatedTreasuryReserves(dto: PaginationDto): Promise<PaginatedDataDto<ReserveEntity>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL');

    query.orderBy('reserves.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [reserves, total] = await query.getManyAndCount();

    return new PaginatedDataDto<ReserveEntity>(
      reserves,
      dto.page ?? 1,
      dto.perPage ?? total,
      total,
    );
  }

  async getOffsetTreasuryReserves(dto: OffsetDto): Promise<OffsetDataDto<ReserveEntity>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL');

    query.orderBy('reserves.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [reserves, total] = await query.getManyAndCount();

    return new OffsetDataDto<ReserveEntity>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async getRevenueReserves(): Promise<ReserveEntity[]> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET, Algorithm.MARKET_V2].join(',')}}`;

    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', { algorithms: algorithmsArrayLiteral })
      .orderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getPaginatedRevenueReserves(dto: PaginationDto): Promise<PaginatedDataDto<ReserveEntity>> {
    const algorithmsArrayLiteral = `{${[
      Algorithm.COMET,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ].join(',')}}`;

    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('reserves.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [reserves, total] = await query.getManyAndCount();

    const sourceGroups = reserves.reduce(
      (acc, item) => {
        const sourceId = item.source.id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(item);
        return acc;
      },
      {} as Record<number, ReserveEntity[]>,
    );

    Object.values(sourceGroups).forEach((sourceReserve) => {
      sourceReserve.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 1; i < sourceReserve.length; i++) {
        const currentOriginalQuantity = BigInt(sourceReserve[i].quantity);
        const previousOriginalQuantity = BigInt(sourceReserve[i - 1].quantity);
        const difference = currentOriginalQuantity - previousOriginalQuantity;
        sourceReserve[i].value =
          Number(ethers.formatUnits(difference, sourceReserve[i].source.asset.decimals)) *
          sourceReserve[i].price;
      }
    });

    reserves.sort((a, b) => {
      const sourceComparison = a.source.id - b.source.id;
      if (sourceComparison !== 0) {
        return sourceComparison;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return new PaginatedDataDto<ReserveEntity>(
      reserves,
      dto.page ?? 1,
      dto.perPage ?? total,
      total,
    );
  }

  async getOffsetRevenueReserves(
    dto: OffsetDto,
    algorithms = [Algorithm.COMET, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
  ): Promise<OffsetDataDto<ReserveEntity>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: `{${algorithms.join(',')}}`,
      });

    query.orderBy('reserves.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [reserves, total] = await query.getManyAndCount();

    const sourceGroups = reserves.reduce(
      (acc, item) => {
        const sourceId = item.source.id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(item);
        return acc;
      },
      {} as Record<number, ReserveEntity[]>,
    );

    Object.values(sourceGroups).forEach((sourceReserve) => {
      sourceReserve.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 1; i < sourceReserve.length; i++) {
        const currentOriginalQuantity = BigInt(sourceReserve[i].quantity);
        const previousOriginalQuantity = BigInt(sourceReserve[i - 1].quantity);
        const difference = currentOriginalQuantity - previousOriginalQuantity;
        sourceReserve[i].value =
          Number(ethers.formatUnits(difference, sourceReserve[i].source.asset.decimals)) *
          sourceReserve[i].price;
      }
    });

    reserves.sort((a, b) => {
      const sourceComparison = a.source.id - b.source.id;
      if (sourceComparison !== 0) {
        return sourceComparison;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return new OffsetDataDto<ReserveEntity>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async deleteAll(): Promise<void> {
    await this.reservesRepository.clear();
  }

  async deleteBySourceIds(sourceIds: number[]): Promise<void> {
    if (sourceIds.length === 0) {
      return;
    }
    await this.reservesRepository
      .createQueryBuilder()
      .delete()
      .where('sourceId IN (:...sourceIds)', { sourceIds })
      .execute();
  }

  async getOffsetIncentivesHistory(
    dto: OffsetDto,
    algorithms = [Algorithm.COMET_STATS, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
  ): Promise<OffsetDataDto<IncentivesHistory>> {
    const order = dto.order === Order.DESC ? Order.DESC : Order.ASC;
    const algorithmsArrayLiteral = `{${algorithms.join(',')}}`;
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? null;
    const sortDirection = order === Order.DESC ? 'DESC' : 'ASC';

    const cteSql = `
      WITH "filtered_sources" AS (
        SELECT s."id", s."assetId"
        FROM "source" s
        WHERE s."deletedAt" IS NULL
          AND s."algorithm" && $1::text[]
      ),
      "latest_spends_ranked" AS (
        SELECT
          s."sourceId" AS "sourceId",
          s."date"::date AS "day",
          s."valueSupply" AS "valueSupply",
          s."valueBorrow" AS "valueBorrow",
          s."priceComp" AS "priceComp",
          ROW_NUMBER() OVER (
            PARTITION BY s."sourceId", s."date"::date
            ORDER BY s."createdAt" DESC, s."id" DESC
          ) AS "rn"
        FROM "spends" s
        INNER JOIN "filtered_sources" fs ON fs."id" = s."sourceId"
      ),
      "latest_spends" AS (
        SELECT
          lsr."sourceId",
          lsr."day",
          lsr."valueSupply",
          lsr."valueBorrow",
          lsr."priceComp"
        FROM "latest_spends_ranked" lsr
        WHERE lsr."rn" = 1
      ),
      "latest_comp_prices_ranked" AS (
        SELECT
          p."date"::date AS "day",
          p."price" AS "priceComp",
          ROW_NUMBER() OVER (
            PARTITION BY p."date"::date
            ORDER BY p."createdAt" DESC, p."id" DESC
          ) AS "rn"
        FROM "price" p
        WHERE p."symbol" = 'COMP'
      ),
      "latest_comp_prices" AS (
        SELECT lcpr."day", lcpr."priceComp"
        FROM "latest_comp_prices_ranked" lcpr
        WHERE lcpr."rn" = 1
      ),
      "reserve_rows" AS (
        SELECT
          r."sourceId" AS "sourceId",
          r."date"::date AS "day",
          r."price" AS "price",
          r."value" AS "value",
          r."quantity"::numeric AS "quantity",
          a."decimals" AS "decimals",
          LAG(r."quantity"::numeric) OVER (
            PARTITION BY r."sourceId"
            ORDER BY r."date" ASC, r."id" ASC
          ) AS "previousQuantity"
        FROM "reserves" r
        INNER JOIN "filtered_sources" fs ON fs."id" = r."sourceId"
        INNER JOIN "asset" a ON a."id" = fs."assetId"
      ),
      "reserve_days" AS (
        SELECT DISTINCT
          rr."sourceId",
          rr."day"
        FROM "reserve_rows" rr
      ),
      "base_rows" AS (
        SELECT
          rr."sourceId" AS "sourceId",
          rr."day" AS "day",
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
      "spends_without_reserve" AS (
        SELECT
          ls."sourceId",
          ls."day",
          ls."valueSupply",
          ls."valueBorrow",
          ls."priceComp"
        FROM "latest_spends" ls
        LEFT JOIN "reserve_days" rd
          ON rd."sourceId" = ls."sourceId"
          AND rd."day" = ls."day"
        WHERE rd."sourceId" IS NULL
      ),
      "spends_only_rows" AS (
        SELECT
          swr."sourceId" AS "sourceId",
          swr."day" AS "day",
          0::double precision AS "incomes",
          COALESCE(swr."valueSupply", 0)::double precision AS "rewardsSupply",
          COALESCE(swr."valueBorrow", 0)::double precision AS "rewardsBorrow",
          COALESCE(NULLIF(swr."priceComp", 0), cp."priceComp", 0)::double precision AS "priceComp"
        FROM "spends_without_reserve" swr
        LEFT JOIN "latest_comp_prices" cp
          ON cp."day" = swr."day"
      ),
      "merged_rows" AS (
        SELECT * FROM "base_rows"
        UNION ALL
        SELECT * FROM "spends_only_rows"
      )
    `;

    const query = `
      ${cteSql},
      "paged_rows" AS (
        SELECT
          mr."sourceId",
          (EXTRACT(EPOCH FROM (mr."day"::timestamp AT TIME ZONE 'UTC')) * 1000)::bigint AS "date",
          mr."incomes",
          mr."rewardsSupply",
          mr."rewardsBorrow",
          mr."priceComp"
        FROM "merged_rows" mr
        ORDER BY mr."day" ${sortDirection}, mr."sourceId" ASC
        OFFSET $2
        ${!limit ? 'LIMIT $3' : ''}
      ),
      "total_rows" AS (
        SELECT COUNT(*)::int AS "total"
        FROM "merged_rows"
      )
      SELECT
        pr."sourceId",
        pr."date",
        pr."incomes",
        pr."rewardsSupply",
        pr."rewardsBorrow",
        pr."priceComp",
        tr."total"
      FROM "total_rows" tr
      LEFT JOIN "paged_rows" pr ON TRUE;
    `;

    const params = !limit
      ? [algorithmsArrayLiteral, offset, limit]
      : [algorithmsArrayLiteral, offset];
    const rawRows = (await this.reservesRepository.query(query, params)) as IncentivesHistoryRaw[];

    const total = rawRows.length > 0 ? Number(rawRows[0].total ?? 0) : 0;
    const data = rawRows
      .filter((row) => row.sourceId !== null && row.date !== null)
      .map(
        (row): IncentivesHistory => ({
          sourceId: Number(row.sourceId),
          date: new Date(Number(row.date)),
          incomes: Number(row.incomes),
          rewardsSupply: Number(row.rewardsSupply),
          rewardsBorrow: Number(row.rewardsBorrow),
          priceComp: Number(row.priceComp),
        }),
      );

    return new OffsetDataDto<IncentivesHistory>(data, limit, offset, total);
  }
}
