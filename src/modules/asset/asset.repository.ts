import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from './asset.entity';

@Injectable()
export class AssetRepository {
  constructor(@InjectRepository(Asset) private readonly repository: Repository<Asset>) {}

  async findById(id: number): Promise<Asset> {
    return this.repository.findOne({ where: { id } });
  }

  async findByAddress(address: string): Promise<Asset> {
    return this.repository.findOne({ where: { address } });
  }

  async save(asset: Asset): Promise<Asset> {
    return this.repository.save(asset);
  }
}
