import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from './source.repository';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { Source } from './source.entity';

@Injectable()
export class SourceService {
  constructor(private readonly repository: SourceRepository) {}

  async create(dto: CreateSourceDto): Promise<Source> {
    const source = new Source(dto.address, dto.algorithm, dto.blockNumber, dto.market);
    return this.repository.save(source);
  }

  async update(dto: UpdateSourceDto): Promise<Source> {
    const source = await this.repository.findById(dto.id);
    if (!source) throw new NotFoundException(`Source with id ${dto.id} not found`);
    Object.assign(source, dto);
    return this.repository.update(source);
  }

  async findById(id: number): Promise<Source> {
    return this.repository.findById(id);
  }
}
