import { Injectable, NotFoundException } from '@nestjs/common';

import { AssetService } from 'modules/asset/asset.service';
import { AssetResponse } from 'modules/asset/response/asset.response';

import { Algorithm } from 'common/enum/algorithm.enum';

import { SourceRepository } from './source.repository';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { SourceEntity } from './source.entity';
import { CreateSourceWithAssetDto } from './dto/create-source-with-asset.dto';
import { UpdateWithSourceDto } from './dto/update-with-source.dto';
import { SourcesWithAssetsResponse } from './response/sourcesWithAssets.response';
import { SourceResponse } from './response/source.response';
import { FindSourceDto } from './dto/find-source.dto';

@Injectable()
export class SourceService {
  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly assetService: AssetService,
  ) {}

  async create(dto: CreateSourceDto): Promise<SourceEntity> {
    const asset = await this.assetService.findById(dto.assetId);
    const source = new SourceEntity(
      dto.address,
      dto.network,
      dto.algorithm,
      dto.type,
      dto.startBlock,
      asset,
      dto.market,
      dto.endBlock,
    );
    return this.sourceRepository.save(source);
  }

  async createWithAsset(dto: CreateSourceWithAssetDto): Promise<SourceEntity> {
    const source = new SourceEntity(
      dto.address,
      dto.network,
      dto.algorithm,
      dto.type,
      dto.startBlock,
      dto.asset,
      dto.market,
      dto.endBlock,
    );
    return this.sourceRepository.save(source);
  }

  async update(dto: UpdateSourceDto): Promise<SourceEntity> {
    const source = await this.sourceRepository.findById(dto.id);
    if (!source) throw new NotFoundException(`Source with id ${dto.id} not found`);
    if (dto.startBlock !== undefined) source.startBlock = dto.startBlock;
    if (dto.endBlock !== undefined) source.endBlock = dto.endBlock;
    source.checkedAt = dto.checkedAt ? dto.checkedAt : new Date();
    return this.sourceRepository.update(source);
  }

  async updateWithSource(dto: UpdateWithSourceDto): Promise<SourceEntity> {
    const source = dto.source;
    if (dto.startBlock !== undefined) source.startBlock = dto.startBlock;
    if (dto.endBlock !== undefined) source.endBlock = dto.endBlock;
    source.checkedAt = dto.checkedAt ? dto.checkedAt : new Date();
    return this.sourceRepository.update(source);
  }

  async findById(id: number): Promise<SourceEntity> {
    return this.sourceRepository.findById(id);
  }

  async findByAddressNetworkAndType(dto: FindSourceDto): Promise<SourceEntity> {
    return this.sourceRepository.findByAddressNetworkAndType(dto);
  }

  async listAll(): Promise<SourceEntity[]> {
    return this.sourceRepository.list();
  }

  async listSourcesWithAssets(): Promise<SourcesWithAssetsResponse> {
    const [sources, assets] = await Promise.all([
      this.sourceRepository.list(),
      this.assetService.listAll(),
    ]);
    return {
      sources: sources.map((source) => new SourceResponse(source)),
      assets: assets.map((asset) => new AssetResponse(asset)),
    };
  }

  async listByAlgorithms(algorithms: Algorithm[]): Promise<SourceEntity[]> {
    return this.sourceRepository.listByAlgorithms(algorithms);
  }
}
