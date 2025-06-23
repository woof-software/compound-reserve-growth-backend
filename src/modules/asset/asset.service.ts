import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AssetRepository } from './asset.repository';
import { CreateAssetDto } from './dto/create-asset.dto';
import { Asset } from './asset.entity';
import { FindAssetDto } from './dto/find-asset.dto';

@Injectable()
export class AssetService {
  constructor(private readonly assetRepository: AssetRepository) {}

  async create(dto: CreateAssetDto): Promise<Asset> {
    const existing = await this.assetRepository.findByAddressAndNetwork(dto.address, dto.network);
    if (existing)
      throw new BadRequestException(
        `Asset with address ${dto.address} already exists in network ${dto.network}`,
      );
    const asset = new Asset(dto.address, dto.decimals, dto.symbol, dto.network, dto.type);
    return this.assetRepository.save(asset);
  }

  async findOrCreate(dto: CreateAssetDto): Promise<Asset> {
    const existing = await this.assetRepository.findByAddressAndNetwork(dto.address, dto.network);
    if (existing) return existing;
    const asset = new Asset(dto.address, dto.decimals, dto.symbol, dto.network, dto.type);
    return this.assetRepository.save(asset);
  }

  async findByAddressAndNetwork(dto: FindAssetDto): Promise<Asset> {
    return this.assetRepository.findByAddressAndNetwork(dto.address, dto.network);
  }

  async findById(id: number): Promise<Asset> {
    const asset = await this.assetRepository.findById(id);
    if (!asset) throw new NotFoundException(`Asset with id ${id} not found`);
    return asset;
  }
}
