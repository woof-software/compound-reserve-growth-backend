import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Source } from './source.entity';
import { FindSourceDto } from './dto/find-source.dto';

@Injectable()
export class SourceRepository {
  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  async findById(id: number): Promise<Source> {
    return this.sourceRepository.findOne({ where: { id }, relations: { asset: true } });
  }

  async findByAddress(address: string): Promise<Source> {
    return this.sourceRepository.findOne({ where: { address } });
  }
  async findByAddressNetworkAndType(dto: FindSourceDto): Promise<Source> {
    return this.sourceRepository.findOne({
      where: { address: dto.address, network: dto.network, type: dto.type },
    });
  }

  async list(): Promise<Source[]> {
    return this.sourceRepository.find({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async listByAlgorithm(algorithm: string): Promise<Source[]> {
    return this.sourceRepository.find({
      where: { algorithm },
      relations: { asset: true },
      order: { id: 'ASC' },
    });
  }

  async save(source: Source): Promise<Source> {
    return this.sourceRepository.save(source);
  }

  async update(source: Source): Promise<Source> {
    source.checkedAt = new Date();
    return this.sourceRepository.save(source);
  }
}
