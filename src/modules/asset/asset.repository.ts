import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetEntity } from './asset.entity';

@Injectable()
export class AssetRepository {
  constructor(
    @InjectRepository(AssetEntity) private readonly repository: Repository<AssetEntity>,
  ) {}

  async findById(id: number): Promise<AssetEntity> {
    return this.repository.findOne({ where: { id } });
  }

  async findByAddressAndNetwork(address: string, network: string): Promise<AssetEntity> {
    return this.repository.findOne({ where: { address, network } });
  }

  async save(asset: AssetEntity): Promise<AssetEntity> {
    return this.repository.save(asset);
  }

  async list(): Promise<AssetEntity[]> {
    return this.repository.find({ order: { id: 'ASC' } });
  }
}
