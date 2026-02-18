import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RevenueEntity } from './revenue.entity';

@Injectable()
export class RevenueRepository {
  constructor(
    @InjectRepository(RevenueEntity) private readonly revenueRepository: Repository<RevenueEntity>,
  ) {}

  async save(revenue: RevenueEntity): Promise<RevenueEntity> {
    return this.revenueRepository.save(revenue);
  }

  async findById(id: number): Promise<RevenueEntity> {
    return this.revenueRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[RevenueEntity[], number]> {
    return this.revenueRepository.findAndCount({
      relations: { source: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  }
}
