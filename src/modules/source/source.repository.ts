import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Source } from './source.entity';

@Injectable()
export class SourceRepository {
  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  async findById(id: number): Promise<Source> {
    return this.sourceRepository.findOne({ where: { id } });
  }

  async findByAddress(address: string): Promise<Source> {
    return this.sourceRepository.findOne({ where: { address } });
  }

  async list(): Promise<Source[]> {
    return this.sourceRepository.find();
  }

  async save(source: Source): Promise<Source> {
    return this.sourceRepository.save(source);
  }

  async update(source: Source): Promise<Source> {
    source.checkedAt = new Date();
    return this.sourceRepository.save(source);
  }
}
