import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Treasury } from './treasury.entity';

@Injectable()
export class TreasuryRepository {
  constructor(
    @InjectRepository(Treasury) private readonly treasuryRepository: Repository<Treasury>,
  ) {}

  async save(treasury: Treasury): Promise<Treasury> {
    return this.treasuryRepository.save(treasury);
  }

  async findById(id: number): Promise<Treasury> {
    return this.treasuryRepository.findOne({
      where: { id },
      relations: { asset: true, source: true },
    });
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[Treasury[], number]> {
    return this.treasuryRepository.findAndCount({
      relations: { asset: true, source: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  }
}
