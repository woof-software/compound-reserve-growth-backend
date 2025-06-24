import { Injectable, NotFoundException } from '@nestjs/common';

import { AssetService } from 'modules/asset/asset.service';

import { SourceRepository } from './source.repository';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { Source } from './source.entity';
import { CreateSourceWithAssetDto } from './dto/create-source-with-asset.dto';
import { UpdateWithSourceDto } from './dto/update-with-source.dto';

@Injectable()
export class SourceService {
  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly assetService: AssetService,
  ) {}

  async create(dto: CreateSourceDto): Promise<Source> {
    const asset = await this.assetService.findById(dto.assetId);
    const source = new Source(
      dto.address,
      dto.network,
      dto.algorithm,
      dto.blockNumber,
      asset,
      dto.market,
    );
    return this.sourceRepository.save(source);
  }

  async createWithAsset(dto: CreateSourceWithAssetDto): Promise<Source> {
    const source = new Source(
      dto.address,
      dto.network,
      dto.algorithm,
      dto.blockNumber,
      dto.asset,
      dto.market,
    );
    return this.sourceRepository.save(source);
  }

  async update(dto: UpdateSourceDto): Promise<Source> {
    const source = await this.sourceRepository.findById(dto.id);
    if (!source) throw new NotFoundException(`Source with id ${dto.id} not found`);
    if (dto.blockNumber) source.blockNumber = dto.blockNumber;
    source.checkedAt = dto.checkedAt ? dto.checkedAt : new Date();
    return this.sourceRepository.update(source);
  }

  async updateWithSource(dto: UpdateWithSourceDto): Promise<Source> {
    const source = dto.source;
    if (dto.blockNumber) source.blockNumber = dto.blockNumber;
    source.checkedAt = dto.checkedAt ? dto.checkedAt : new Date();
    return this.sourceRepository.update(source);
  }

  async findById(id: number): Promise<Source> {
    return this.sourceRepository.findById(id);
  }

  async listAll(): Promise<Source[]> {
    return this.sourceRepository.list();
  }
}
