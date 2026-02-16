import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SourceEntity } from './source.entity';
import { FindSourceDto } from './dto/find-source.dto';
import { Algorithm } from 'common/enum/algorithm.enum';

@Injectable()
export class SourceRepository {
  constructor(
    @InjectRepository(SourceEntity)
    private readonly sourceRepository: Repository<SourceEntity>,
  ) {}

  async findById(id: number): Promise<SourceEntity> {
    return this.sourceRepository.findOne({ where: { id }, relations: { asset: true } });
  }

  async findByAddress(address: string): Promise<SourceEntity> {
    return this.sourceRepository.findOne({ where: { address } });
  }
  async findByAddressNetworkAndType(dto: FindSourceDto): Promise<SourceEntity> {
    return this.sourceRepository.findOne({
      where: { address: dto.address, network: dto.network, type: dto.type },
    });
  }

  async list(): Promise<SourceEntity[]> {
    return this.sourceRepository.find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async save(source: SourceEntity): Promise<SourceEntity> {
    return this.sourceRepository.save(source);
  }

  async update(source: SourceEntity): Promise<SourceEntity> {
    source.checkedAt = new Date();
    return this.sourceRepository.save(source);
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
