import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { SpendsEntity } from '@/modules/history/entities';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class SpendsRepository {
  constructor(
    @InjectRepository(SpendsEntity) private readonly spendsRepository: Repository<SpendsEntity>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<SpendsEntity> {
    return manager?.getRepository(SpendsEntity) ?? this.spendsRepository;
  }

  async save(reserve: SpendsEntity, manager?: EntityManager): Promise<SpendsEntity> {
    const repository = this.getRepository(manager);
    await repository
      .createQueryBuilder()
      .insert()
      .into(SpendsEntity)
      .values(reserve)
      .orUpdate(
        [
          'blockNumber',
          'quantitySupply',
          'quantityBorrow',
          'price',
          'priceComp',
          'valueSupply',
          'valueBorrow',
        ],
        ['sourceId', 'date'],
        {
          skipUpdateIfNoValuesChanged: true,
        },
      )
      .execute();

    return reserve;
  }

  async findById(id: number): Promise<SpendsEntity | null> {
    return this.spendsRepository
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('spends.id = :id', { id })
      .getOne();
  }

  async findBySourceId(sourceId: number, manager?: EntityManager): Promise<SpendsEntity | null> {
    return this.getRepository(manager)
      .createQueryBuilder('spends')
      .leftJoinAndSelect('spends.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('source.id = :sourceId', { sourceId })
      .orderBy('spends.date', 'DESC')
      .addOrderBy('spends.id', 'DESC')
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

  async deleteAll(manager?: EntityManager): Promise<void> {
    await this.getRepository(manager).clear();
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
