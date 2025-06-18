import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Revenue } from './revenue.entity';

@Injectable()
export class RevenueRepository {
  constructor(@InjectRepository(Revenue) private readonly revenueRepository: Repository<Revenue>) {}

  async save(revenue: Revenue): Promise<Revenue> {
    return this.revenueRepository.save(revenue);
  }

  async findById(id: number): Promise<Revenue> {
    return this.revenueRepository.findOne({
      where: { id },
      relations: { asset: true, source: true },
    });
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[Revenue[], number]> {
    return this.revenueRepository.findAndCount({
      relations: { asset: true, source: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  }
}
