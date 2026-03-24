import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';

import { RevenueRepository } from './revenue.repository';
import { RevenueEntity } from './revenue.entity';
import { CreateRevenueDto } from './dto/create-revenue.dto';

@Injectable()
export class RevenueService {
  constructor(
    private readonly revenueRepository: RevenueRepository,
    private readonly sourceRepository: SourceRepository,
  ) {}

  async create(dto: CreateRevenueDto): Promise<RevenueEntity> {
    const source = await this.sourceRepository.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);
    const revenue = new RevenueEntity(
      source,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.revenueRepository.save(revenue);
  }

  async findById(id: number): Promise<RevenueEntity> {
    const entity = await this.revenueRepository.findById(id);
    if (!entity) throw new NotFoundException(`Revenue ${id} not found`);
    return entity;
  }
}
