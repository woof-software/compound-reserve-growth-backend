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

  async findById(id: number): Promise<RevenueEntity | null> {
    return this.revenueRepository
      .createQueryBuilder('revenue')
      .innerJoinAndSelect('revenue.source', 'source')
      .where('revenue.id = :id', { id })
      .andWhere('source.deletedAt IS NULL')
      .getOne();
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[RevenueEntity[], number]> {
    const [items, total] = await this.revenueRepository
      .createQueryBuilder('revenue')
      .innerJoinAndSelect('revenue.source', 'source')
      .where('source.deletedAt IS NULL')
      .orderBy('revenue.createdAt', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();
    return [items, total];
  }
}
