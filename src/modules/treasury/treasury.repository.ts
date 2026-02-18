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

  async findById(id: number): Promise<TreasuryEntity> {
    return this.treasuryRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[TreasuryEntity[], number]> {
    return this.treasuryRepository.findAndCount({
      relations: { source: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  }
}
