import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { IncomesEntity } from './entities';

import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Algorithm } from '@app/common/enum/algorithm.enum';

@Injectable()
export class IncomesRepository {
  constructor(
    @InjectRepository(IncomesEntity) private readonly incomesRepository: Repository<IncomesEntity>,
  ) {}

  async save(reserve: IncomesEntity): Promise<IncomesEntity> {
    return this.incomesRepository.save(reserve);
  }

  async findById(id: number): Promise<IncomesEntity> {
    return this.incomesRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async findBySourceId(sourceId: number): Promise<IncomesEntity> {
    return this.incomesRepository.findOne({
      where: { source: { id: sourceId } },
      relations: { source: true },
      order: { blockNumber: 'DESC' },
    });
  }

  async getOffsetStats(dto: OffsetDto): Promise<OffsetDataDto<IncomesEntity>> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET_STATS].join(',')}}`;

    const query = this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('incomes.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [incomes, total] = await query.getManyAndCount();

    return new OffsetDataDto<IncomesEntity>(incomes, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async deleteAll(): Promise<void> {
    await this.incomesRepository.clear();
  }

  async findAllWithMissingPriceComp(): Promise<IncomesEntity[]> {
    return this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .where('incomes.priceComp IS NULL OR incomes.priceComp = 0')
      .orderBy('incomes.date', 'ASC')
      .getMany();
  }

  async updatePriceComp(id: number, priceComp: number): Promise<void> {
    await this.incomesRepository.update(id, { priceComp });
  }
}
