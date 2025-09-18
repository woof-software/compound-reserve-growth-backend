import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { Spends } from './entities';

import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Algorithm } from '@app/common/enum/algorithm.enum';

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

  async findBySourceId(sourceId: number): Promise<Spends> {
    return this.spendsRepository.findOne({
      where: { source: { id: sourceId } },
      relations: { source: true },
    });
  }

  async getOffsetStats(dto: OffsetDto): Promise<OffsetDataDto<Spends>> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET, Algorithm.MARKET_V2].join(',')}}`;

    const query = this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('spends.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [spends, total] = await query.getManyAndCount();

    return new OffsetDataDto<Spends>(spends, dto.limit ?? null, dto.offset ?? 0, total);
  }
}
