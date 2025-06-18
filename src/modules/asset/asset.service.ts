import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AssetRepository } from './asset.repository';
import { CreateAssetDto } from './dto/create-asset.dto';
import { Asset } from './asset.entity';

@Injectable()
export class AssetService {
  constructor(private readonly repository: AssetRepository) {}

  async create(dto: CreateAssetDto): Promise<Asset> {
    const existing = await this.repository.findByAddress(dto.address);
    if (existing) throw new BadRequestException(`Asset with address ${dto.address} already exists`);
    const asset = new Asset(dto.address, dto.decimals, dto.symbol, dto.chain, dto.type);
    return this.repository.save(asset);
  }

  async findById(id: number): Promise<Asset> {
    const asset = await this.repository.findById(id);
    if (!asset) throw new NotFoundException(`Asset with id ${id} not found`);
    return asset;
  }
}
