import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

  async findAssetByAddressAndNetwork(address: string, network: string): Promise<Asset | null> {
    return this.assetRepo.findOne({ where: { address, network } });
  }

  async findAssetById(id: number): Promise<Asset | null> {
    return this.assetRepo.findOne({ where: { id } });
  }

  async saveAsset(asset: Asset): Promise<Asset> {
    return this.assetRepo.save(asset);
  }

  async listAllSources(): Promise<Source[]> {
    return this.sourceRepo.find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async saveSource(source: Source): Promise<Source> {
    return this.sourceRepo.save(source);
  }
}
