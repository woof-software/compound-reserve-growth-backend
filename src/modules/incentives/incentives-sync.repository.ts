import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { IncentiveCompPrice } from './types/incentive-comp-price.type';
import { IncentiveProjectionRow } from './types/incentive-projection-row.type';
import { IncentiveReserveSnapshot } from './types/incentive-reserve-snapshot.type';
import { IncentiveSpendSnapshot } from './types/incentive-spend-snapshot.type';
import { INCENTIVES_SUPPORTED_ALGORITHMS } from './constants/incentives-supported-algorithms.constant';

type IncentiveReserveSnapshotRaw = {
  reserveId: number | string;
  sourceId: number | string;
  date: string | Date;
  day: string;
  price: number | string;
  value: number | string;
  quantity: string;
  decimals: number | string;
};

type IncentiveSpendSnapshotRaw = {
  spendId: number | string;
  sourceId: number | string;
  date: string | Date;
  day: string;
  valueSupply: number | string | null;
  valueBorrow: number | string | null;
  priceComp: number | string | null;
};

type IncentiveCompPriceRaw = {
  day: string;
  priceComp: number | string;
};

@Injectable()
export class IncentivesSyncRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  public async listSupportedSourceIds(manager: EntityManager): Promise<number[]> {
    const rawRows = (await manager.query(
      `
        SELECT s."id" AS "id"
        FROM "source" s
        WHERE s."deletedAt" IS NULL
          AND s."algorithm" && $1::text[]
        ORDER BY s."id" ASC
      `,
      [this.getSupportedAlgorithmsArrayLiteral()],
    )) as Array<{ id: number | string }>;

    return rawRows.map((row) => Number(row.id));
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

  public async deleteOutsideScope(
    validSourceIds: number[],
    manager: EntityManager,
  ): Promise<number> {
    const deletedRows = (await manager.query(
      `
        DELETE FROM "incentives" i
        WHERE EXISTS (
          SELECT 1
          FROM "source" s
          WHERE s."id" = i."sourceId"
            AND s."deletedAt" IS NOT NULL
        )
        OR NOT (i."sourceId" = ANY($1::int[]))
        RETURNING i."id"
      `,
      [validSourceIds],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  public async deleteBySourceIds(sourceIds: number[], manager: EntityManager): Promise<number> {
    if (sourceIds.length === 0) {
      return 0;
    }

    const deletedRows = (await manager.query(
      `
        DELETE FROM "incentives"
        WHERE "sourceId" = ANY($1::int[])
        RETURNING "id"
      `,
      [sourceIds],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  public async listDailyReserveSnapshots(
    sourceIds: number[],
    manager: EntityManager,
  ): Promise<IncentiveReserveSnapshot[]> {
    if (sourceIds.length === 0) {
      return [];
    }

    const rawRows = (await manager.query(
      `
        WITH "filtered_sources" AS (
          SELECT s."id", s."assetId"
          FROM "source" s
          WHERE s."deletedAt" IS NULL
            AND s."id" = ANY($1::int[])
        )
        SELECT DISTINCT ON (r."sourceId", r."date")
          r."id" AS "reserveId",
          r."sourceId" AS "sourceId",
          r."date" AS "date",
          r."date"::date::text AS "day",
          r."price" AS "price",
          r."value" AS "value",
          r."quantity"::text AS "quantity",
          a."decimals" AS "decimals"
        FROM "reserves" r
        INNER JOIN "filtered_sources" fs ON fs."id" = r."sourceId"
        INNER JOIN "asset" a ON a."id" = fs."assetId"
        ORDER BY
          r."sourceId" ASC,
          r."date" ASC,
          r."blockNumber" DESC,
          r."id" DESC
      `,
      [sourceIds],
    )) as IncentiveReserveSnapshotRaw[];

    return rawRows.map((row) => ({
      reserveId: Number(row.reserveId),
      sourceId: Number(row.sourceId),
      date: new Date(row.date),
      day: row.day,
      price: Number(row.price),
      value: Number(row.value),
      quantity: row.quantity,
      decimals: Number(row.decimals),
    }));
  }

  public async listLatestSpends(
    sourceIds: number[],
    manager: EntityManager,
  ): Promise<IncentiveSpendSnapshot[]> {
    if (sourceIds.length === 0) {
      return [];
    }

    const rawRows = (await manager.query(
      `
        WITH "filtered_sources" AS (
          SELECT s."id"
          FROM "source" s
          WHERE s."deletedAt" IS NULL
            AND s."id" = ANY($1::int[])
        )
        SELECT DISTINCT ON (s."sourceId", s."date"::date)
          s."id" AS "spendId",
          s."sourceId" AS "sourceId",
          s."date" AS "date",
          s."date"::date::text AS "day",
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
      `,
      [sourceIds],
    )) as IncentiveSpendSnapshotRaw[];

    return rawRows.map((row) => ({
      spendId: Number(row.spendId),
      sourceId: Number(row.sourceId),
      date: new Date(row.date),
      day: row.day,
      valueSupply: Number(row.valueSupply ?? 0),
      valueBorrow: Number(row.valueBorrow ?? 0),
      priceComp: Number(row.priceComp ?? 0),
    }));
  }

  public async listLatestCompPrices(
    days: string[],
    manager: EntityManager,
  ): Promise<IncentiveCompPrice[]> {
    if (days.length === 0) {
      return [];
    }

    const rawRows = (await manager.query(
      `
        SELECT DISTINCT ON (p."date"::date)
          p."date"::date::text AS "day",
          p."price" AS "priceComp"
        FROM "price" p
        WHERE p."symbol" = 'COMP'
          AND p."date"::date = ANY($1::date[])
        ORDER BY
          p."date"::date ASC,
          p."createdAt" DESC,
          p."id" DESC
      `,
      [days],
    )) as IncentiveCompPriceRaw[];

    return rawRows.map((row) => ({
      day: row.day,
      priceComp: Number(row.priceComp),
    }));
  }

  public async insertRows(rows: IncentiveProjectionRow[], manager: EntityManager): Promise<number> {
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

    for (let index = 0; index < rows.length; index += size) {
      chunks.push(rows.slice(index, index + size));
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

  private getSupportedAlgorithmsArrayLiteral(): string {
    return `{${[...INCENTIVES_SUPPORTED_ALGORITHMS].join(',')}}`;
  }
}
