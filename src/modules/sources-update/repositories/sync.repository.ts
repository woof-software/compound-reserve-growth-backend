import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { AssetEntity } from 'modules/asset/asset.entity';
import { SourceEntity } from 'modules/source/source.entity';

@Injectable()
export class SyncRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  /** Only active assets (deletedAt IS NULL). Use for read paths that must hide soft-deleted. */
  public async listAllAssets(manager: EntityManager): Promise<AssetEntity[]> {
    return manager.getRepository(AssetEntity).find({
      where: { deletedAt: null },
      order: { id: 'ASC' },
    });
  }

  /** All assets including soft-deleted. Use only in sync to match remote id and allow restore. */
  public async listAllAssetsIncludingDeleted(manager: EntityManager): Promise<AssetEntity[]> {
    return manager.getRepository(AssetEntity).find({ order: { id: 'ASC' } });
  }

  public async saveAssets(assets: AssetEntity[], manager: EntityManager): Promise<AssetEntity[]> {
    return manager.getRepository(AssetEntity).save(assets);
  }

  public async insertAssetsWithIds(
    assets: AssetEntity[],
    manager: EntityManager,
  ): Promise<AssetEntity[]> {
    if (!assets.length) return [];

    return (await manager.query(
      `
        INSERT INTO "asset" (
          "id",
          "address",
          "decimals",
          "symbol",
          "network",
          "type",
          "createdAt",
          "deletedAt"
        )
        VALUES ${this.buildValuesClause(assets.length, 8)}
        RETURNING
          "id",
          "address",
          "decimals",
          "symbol",
          "network",
          "type",
          "createdAt",
          "deletedAt"
      `,
      assets.flatMap((asset) => [
        asset.id,
        asset.address,
        asset.decimals,
        asset.symbol,
        asset.network,
        asset.type ?? null,
        asset.createdAt,
        asset.deletedAt ?? null,
      ]),
    )) as AssetEntity[];
  }

  public async deleteAssetsByIds(ids: number[], manager: EntityManager): Promise<void> {
    if (!ids.length) return;

    await manager
      .getRepository(AssetEntity)
      .createQueryBuilder()
      .update()
      .set({ deletedAt: () => 'NOW()' })
      .where('id IN (:...ids)', { ids })
      .andWhere('deletedAt IS NULL')
      .execute();
  }

  /** Only active sources (deletedAt IS NULL). Use for read paths that must hide soft-deleted. */
  public async listAllSources(manager: EntityManager): Promise<SourceEntity[]> {
    return manager.getRepository(SourceEntity).find({
      where: { deletedAt: null },
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  /** All sources including soft-deleted. Use only in sync to match remote id and allow restore. */
  public async listAllSourcesIncludingDeleted(manager: EntityManager): Promise<SourceEntity[]> {
    return manager.getRepository(SourceEntity).find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  public async saveSources(
    sources: SourceEntity[],
    manager: EntityManager,
  ): Promise<SourceEntity[]> {
    return manager.getRepository(SourceEntity).save(sources);
  }

  public async insertSourcesWithIds(
    sources: SourceEntity[],
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `
        INSERT INTO "source" (
          "id",
          "address",
          "network",
          "market",
          "type",
          "algorithm",
          "startBlock",
          "endBlock",
          "createdAt",
          "checkedAt",
          "deletedAt",
          "assetId"
        )
        VALUES ${this.buildValuesClause(sources.length, 12)}
        RETURNING "id"
      `,
      sources.flatMap((source) => [
        source.id,
        source.address,
        source.network,
        source.market ?? null,
        source.type ?? null,
        source.algorithm,
        source.startBlock,
        source.endBlock ?? null,
        source.createdAt,
        source.checkedAt ?? null,
        source.deletedAt ?? null,
        source.asset.id,
      ]),
    );
  }

  public async deleteSourcesByIds(ids: number[], manager: EntityManager): Promise<void> {
    if (!ids.length) return;

    await manager
      .getRepository(SourceEntity)
      .createQueryBuilder()
      .update()
      .set({ deletedAt: () => 'NOW()' })
      .where('id IN (:...ids)', { ids })
      .andWhere('deletedAt IS NULL')
      .execute();
  }

  public async alignAssetIdSequence(manager: EntityManager): Promise<void> {
    await this.alignSequence('asset', manager);
  }

  public async alignSourceIdSequence(manager: EntityManager): Promise<void> {
    await this.alignSequence('source', manager);
  }

  private async alignSequence(tableName: string, manager: EntityManager): Promise<void> {
    await manager.query(
      `
        SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE((SELECT MAX(id) FROM "${tableName}"), 0),
          COALESCE((SELECT MAX(id) IS NOT NULL FROM "${tableName}"), false)
        )
      `,
      [tableName],
    );
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
