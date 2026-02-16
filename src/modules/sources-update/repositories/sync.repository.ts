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

  public async listAllAssets(manager: EntityManager): Promise<AssetEntity[]> {
    return manager.getRepository(AssetEntity).find({ order: { id: 'ASC' } });
  }

  public async saveAssets(assets: AssetEntity[], manager: EntityManager): Promise<AssetEntity[]> {
    return manager.getRepository(AssetEntity).save(assets);
  }

  public async listAllSources(manager: EntityManager): Promise<SourceEntity[]> {
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
}
