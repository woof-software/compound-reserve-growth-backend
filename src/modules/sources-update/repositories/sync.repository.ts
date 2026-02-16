import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';

@Injectable()
export class SyncRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async listAllAssets(manager: EntityManager): Promise<Asset[]> {
    return manager.getRepository(Asset).find({ order: { id: 'ASC' } });
  }

  async saveAssets(assets: Asset[], manager: EntityManager): Promise<Asset[]> {
    return manager.getRepository(Asset).save(assets);
  }

  async listAllSources(manager: EntityManager): Promise<Source[]> {
    return manager.getRepository(Source).find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async saveSources(sources: Source[], manager: EntityManager): Promise<Source[]> {
    return manager.getRepository(Source).save(sources);
  }
}
