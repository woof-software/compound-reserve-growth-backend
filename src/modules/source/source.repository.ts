import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Algorithm } from 'common/enum/algorithm.enum';

import { SourceEntity } from './source.entity';

@Injectable()
export class SourceRepository {
  constructor(
    @InjectRepository(SourceEntity)
    private readonly sourceRepository: Repository<SourceEntity>,
  ) {}

  async findById(id: number): Promise<SourceEntity> {
    return this.sourceRepository.findOne({ where: { id }, relations: { asset: true } });
  }

  async list(): Promise<SourceEntity[]> {
    return this.sourceRepository.find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async listByAlgorithms(algorithms: Algorithm[]): Promise<SourceEntity[]> {
    const algorithmsArrayLiteral = `{${algorithms.join(',')}}`;

    return this.sourceRepository
      .createQueryBuilder('source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      })
      .orderBy('source.id', 'ASC')
      .getMany();
  }
}
