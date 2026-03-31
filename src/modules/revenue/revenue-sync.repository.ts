import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { RevenueProjectionRow } from './types/revenue-projection-row.type';
import { RevenueReserveSnapshot } from './types/revenue-reserve-snapshot.type';
import { RevenueSourceCheckpoint } from './types/revenue-source-checkpoint.type';
import { REVENUE_SUPPORTED_ALGORITHMS } from './constants/revenue-supported-algorithms.constant';

type RevenueSourceCheckpointRaw = {
  sourceId: number | string;
  checkpointDate: string;
};

type RevenueReserveSnapshotRaw = {
  reserveId: number | string;
  sourceId: number | string;
  blockNumber: number | string;
  date: string | Date;
  price: number | string;
  quantity: string;
  decimals: number | string;
  isLookback: boolean;
};

@Injectable()
export class RevenueSyncRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listSupportedSourceIds(manager: EntityManager): Promise<number[]> {
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

  async deleteOutsideScope(validSourceIds: number[], manager: EntityManager): Promise<number> {
    const deletedRows = (await manager.query(
      `
        DELETE FROM "revenue" rv
        WHERE EXISTS (
          SELECT 1
          FROM "source" s
          WHERE s."id" = rv."sourceId"
            AND s."deletedAt" IS NOT NULL
        )
        OR NOT (rv."sourceId" = ANY($1::int[]))
        RETURNING rv."id"
      `,
      [validSourceIds],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  async deleteBySourceIds(sourceIds: number[], manager: EntityManager): Promise<number> {
    if (sourceIds.length === 0) {
      return 0;
    }

    const deletedRows = (await manager.query(
      `
        DELETE FROM "revenue"
        WHERE "sourceId" = ANY($1::int[])
        RETURNING "id"
      `,
      [sourceIds],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  async listSourceCheckpoints(
    sourceIds: number[],
    manager: EntityManager,
  ): Promise<RevenueSourceCheckpoint[]> {
    if (sourceIds.length === 0) {
      return [];
    }

    const rawRows = (await manager.query(
      `
        SELECT DISTINCT ON (r."sourceId")
          r."sourceId" AS "sourceId",
          r."date"::text AS "checkpointDate"
        FROM "revenue" r
        WHERE r."sourceId" = ANY($1::int[])
        ORDER BY
          r."sourceId" ASC,
          r."date" DESC,
          r."reserveId" DESC
      `,
      [sourceIds],
    )) as RevenueSourceCheckpointRaw[];

    return rawRows.map((row) => ({
      sourceId: Number(row.sourceId),
      checkpointDate: row.checkpointDate,
    }));
  }

  async deleteFromCheckpoints(
    checkpoints: RevenueSourceCheckpoint[],
    manager: EntityManager,
  ): Promise<number> {
    if (checkpoints.length === 0) {
      return 0;
    }

    const checkpointSourceIds = checkpoints.map((checkpoint) => checkpoint.sourceId);
    const checkpointDates = checkpoints.map((checkpoint) => checkpoint.checkpointDate);
    const deletedRows = (await manager.query(
      `
        WITH "source_checkpoints" AS (
          SELECT *
          FROM unnest($1::int[], $2::timestamp[]) AS sc("sourceId", "checkpointDate")
        )
        DELETE FROM "revenue" rv
        USING "source_checkpoints" sc
        WHERE rv."sourceId" = sc."sourceId"
          AND rv."date" >= sc."checkpointDate"
        RETURNING rv."id"
      `,
      [checkpointSourceIds, checkpointDates],
    )) as Array<{ id: number }>;

    return deletedRows.length;
  }

  async listProjectionReserveSnapshots(
    sourceIds: number[],
    checkpoints: RevenueSourceCheckpoint[],
    manager: EntityManager,
  ): Promise<RevenueReserveSnapshot[]> {
    if (sourceIds.length === 0) {
      return [];
    }

    const checkpointSourceIds = checkpoints.map((checkpoint) => checkpoint.sourceId);
    const checkpointDates = checkpoints.map((checkpoint) => checkpoint.checkpointDate);
    const rawRows = (await manager.query(
      `
        WITH "filtered_sources" AS (
          SELECT s."id", s."assetId"
          FROM "source" s
          WHERE s."deletedAt" IS NULL
            AND s."id" = ANY($1::int[])
        ),
        "source_checkpoints" AS (
          SELECT *
          FROM unnest($2::int[], $3::timestamp[]) AS sc("sourceId", "checkpointDate")
        ),
        "daily_reserves" AS (
          SELECT DISTINCT ON (r."sourceId", r."date")
            r."id" AS "reserveId",
            r."sourceId" AS "sourceId",
            r."blockNumber" AS "blockNumber",
            r."date" AS "date",
            r."price" AS "price",
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
        )
        SELECT
          cr."reserveId",
          cr."sourceId",
          cr."blockNumber",
          cr."date",
          cr."price",
          cr."quantity",
          cr."decimals",
          cr."isLookback"
        FROM "candidate_reserves" cr
        ORDER BY
          cr."date" ASC,
          cr."sourceId" ASC,
          cr."reserveId" ASC
      `,
      [sourceIds, checkpointSourceIds, checkpointDates],
    )) as RevenueReserveSnapshotRaw[];

    return rawRows.map((row) => ({
      reserveId: Number(row.reserveId),
      sourceId: Number(row.sourceId),
      blockNumber: Number(row.blockNumber),
      date: new Date(row.date),
      price: Number(row.price),
      quantity: row.quantity,
      decimals: Number(row.decimals),
      isLookback: row.isLookback,
    }));
  }

  async insertRows(rows: RevenueProjectionRow[], manager: EntityManager): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const now = new Date();
    const insertedCountByBatch: number[] = [];

    for (const chunk of this.chunkRows(rows, 500)) {
      const result = (await manager.query(
        `
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
          VALUES ${this.buildValuesClause(chunk.length, 9)}
          ON CONFLICT ("reserveId") DO NOTHING
          RETURNING "id"
        `,
        chunk.flatMap((row) => [
          row.reserveId,
          row.sourceId,
          row.blockNumber,
          row.quantityDelta,
          row.price,
          row.value,
          row.date,
          now,
          now,
        ]),
      )) as Array<{ id: number }>;

      insertedCountByBatch.push(result.length);
    }

    return insertedCountByBatch.reduce((sum, count) => sum + count, 0);
  }

  private chunkRows(rows: RevenueProjectionRow[], size: number): RevenueProjectionRow[][] {
    const chunks: RevenueProjectionRow[][] = [];

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
    return `{${[...REVENUE_SUPPORTED_ALGORITHMS].join(',')}}`;
  }
}
