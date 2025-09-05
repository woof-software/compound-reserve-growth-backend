import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Incomes } from './entity';

@Injectable()
export class IncomesRepository {
  constructor(@InjectRepository(Incomes) private readonly incomesRepository: Repository<Incomes>) {}

  async save(reserve: Incomes): Promise<Incomes> {
    return this.incomesRepository.save(reserve);
  }

  async findById(id: number): Promise<Incomes> {
    return this.incomesRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }
}
