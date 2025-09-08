import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { Incomes } from './entities';

import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Algorithm } from '@app/common/enum/algorithm.enum';

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

  async getOffsetStats(dto: OffsetDto): Promise<OffsetDataDto<Incomes>> {
    const query = this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm IN (:...algorithms)', {
        algorithms: [Algorithm.COMET, Algorithm.MARKET_V2],
      });

    query.orderBy('incomes.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [incomes, total] = await query.getManyAndCount();

    return new OffsetDataDto<Incomes>(incomes, dto.limit ?? null, dto.offset ?? 0, total);
  }
}
