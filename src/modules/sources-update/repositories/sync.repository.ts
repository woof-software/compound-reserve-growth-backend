import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';

@Injectable()
export class SyncRepository {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Source)
    private readonly sourceRepo: Repository<Source>,
  ) {}

  async listAllAssets(): Promise<Asset[]> {
    return this.assetRepo.find({ order: { id: 'ASC' } });
  }

  /** Batch save assets. Pass manager to run inside a transaction. */
  async saveAssets(assets: Asset[], manager?: EntityManager): Promise<Asset[]> {
    if (manager) return manager.getRepository(Asset).save(assets);
    return this.assetRepo.save(assets);
  }

  async listAllSources(): Promise<Source[]> {
    return this.sourceRepo.find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  /** Batch save sources. Pass manager to run inside a transaction. */
  async saveSources(sources: Source[], manager?: EntityManager): Promise<Source[]> {
    if (manager) return manager.getRepository(Source).save(sources);
    return this.sourceRepo.save(sources);
  }
}
