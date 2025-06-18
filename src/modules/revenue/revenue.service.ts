import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { AssetRepository } from 'modules/asset/asset.repository';

import { RevenueRepository } from './revenue.repository';
import { Revenue } from './revenue.entity';
import { CreateRevenueDto } from './dto/create-revenue.dto';

@Injectable()
export class RevenueService {
  constructor(
    private readonly revenueRepository: RevenueRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly assetRepository: AssetRepository,
  ) {}

  async create(dto: CreateRevenueDto): Promise<Revenue> {
    const source = await this.sourceRepository.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);
    const asset = await this.assetRepository.findById(dto.assetId);
    if (!asset) throw new NotFoundException(`Asset ${dto.assetId} not found`);
    const revenue = new Revenue(
      source,
      asset,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.revenueRepository.save(revenue);
  }

  async findById(id: number): Promise<Revenue> {
    return this.revenueRepository.findById(id);
  }
}
