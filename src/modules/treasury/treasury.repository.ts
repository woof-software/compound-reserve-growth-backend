import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TreasuryEntity } from './treasury.entity';

@Injectable()
export class TreasuryRepository {
  constructor(
    @InjectRepository(TreasuryEntity)
    private readonly treasuryRepository: Repository<TreasuryEntity>,
  ) {}

  async save(treasury: TreasuryEntity): Promise<TreasuryEntity> {
    return this.treasuryRepository.save(treasury);
  }

  async findById(id: number): Promise<TreasuryEntity | null> {
    return this.treasuryRepository
      .createQueryBuilder('treasury')
      .innerJoinAndSelect('treasury.source', 'source')
      .where('treasury.id = :id', { id })
      .andWhere('source.deletedAt IS NULL')
      .getOne();
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[TreasuryEntity[], number]> {
    const [items, total] = await this.treasuryRepository
      .createQueryBuilder('treasury')
      .innerJoinAndSelect('treasury.source', 'source')
      .where('source.deletedAt IS NULL')
      .orderBy('treasury.createdAt', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();
    return [items, total];
  }
}
