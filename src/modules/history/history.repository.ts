import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { History } from './history.entity';

@Injectable()
export class HistoryRepository {
  constructor(@InjectRepository(History) private readonly historyRepository: Repository<History>) {}

  async save(history: History): Promise<History> {
    return this.historyRepository.save(history);
  }

  async findById(id: number): Promise<History> {
    return this.historyRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async paginate(page: number = 1, perPage: number = 20): Promise<[History[], number]> {
    return this.historyRepository.findAndCount({
      relations: { source: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  }
}
