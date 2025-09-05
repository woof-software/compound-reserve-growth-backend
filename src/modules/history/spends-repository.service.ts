import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Spends } from './entity';

@Injectable()
export class SpendsRepository {
  constructor(@InjectRepository(Spends) private readonly spendsRepository: Repository<Spends>) {}

  async save(reserve: Spends): Promise<Spends> {
    return this.spendsRepository.save(reserve);
  }

  async findById(id: number): Promise<Spends> {
    return this.spendsRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }
}
