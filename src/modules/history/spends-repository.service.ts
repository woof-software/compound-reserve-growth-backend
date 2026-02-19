import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { SpendsEntity } from './entities';

import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Algorithm } from '@app/common/enum/algorithm.enum';

@Injectable()
export class SpendsRepository {
  constructor(
    @InjectRepository(SpendsEntity) private readonly spendsRepository: Repository<SpendsEntity>,
  ) {}

  async save(reserve: SpendsEntity): Promise<SpendsEntity> {
    return this.spendsRepository.save(reserve);
  }

  async findById(id: number): Promise<SpendsEntity> {
    return this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .where('spends.id = :id', { id })
      .andWhere('source.deletedAt IS NULL')
      .getOne();
  }

  async findBySourceId(sourceId: number): Promise<SpendsEntity> {
    return this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .where('source.id = :sourceId', { sourceId })
      .andWhere('source.deletedAt IS NULL')
      .orderBy('spends.blockNumber', 'DESC')
      .getOne();
  }

  async getOffsetStats(
    dto: OffsetDto,
    algorithms = [Algorithm.COMET_STATS],
  ): Promise<OffsetDataDto<SpendsEntity>> {
    const algorithmsArrayLiteral = `{${algorithms.join(',')}}`;

    const query = this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('spends.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [spends, total] = await query.getManyAndCount();

    return new OffsetDataDto<SpendsEntity>(spends, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async deleteAll(): Promise<void> {
    await this.spendsRepository.clear();
  }

  async findAllWithMissingPriceComp(): Promise<SpendsEntity[]> {
    return this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('spends.priceComp IS NULL OR spends.priceComp = 0')
      .orderBy('spends.date', 'ASC')
      .getMany();
  }

  async updatePriceComp(id: number, priceComp: number): Promise<void> {
    await this.spendsRepository.update(id, { priceComp });
  }
}
