import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { IncomesEntity } from '@/modules/history/entities';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class IncomesRepository {
  constructor(
    @InjectRepository(IncomesEntity) private readonly incomesRepository: Repository<IncomesEntity>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<IncomesEntity> {
    return manager?.getRepository(IncomesEntity) ?? this.incomesRepository;
  }

  async save(reserve: IncomesEntity, manager?: EntityManager): Promise<IncomesEntity> {
    const repository = this.getRepository(manager);
    await repository
      .createQueryBuilder()
      .insert()
      .into(IncomesEntity)
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

  async findById(id: number): Promise<IncomesEntity | null> {
    return this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('incomes.id = :id', { id })
      .getOne();
  }

  async findBySourceId(sourceId: number, manager?: EntityManager): Promise<IncomesEntity | null> {
    return this.getRepository(manager)
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('source.id = :sourceId', { sourceId })
      .orderBy('incomes.date', 'DESC')
      .addOrderBy('incomes.id', 'DESC')
      .getOne();
  }

  async getOffsetStats(dto: OffsetDto): Promise<OffsetDataDto<IncomesEntity>> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET_STATS].join(',')}}`;

    const query = this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('incomes.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [incomes, total] = await query.getManyAndCount();

    return new OffsetDataDto<IncomesEntity>(incomes, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async deleteAll(manager?: EntityManager): Promise<void> {
    await this.getRepository(manager).clear();
  }

  async findAllWithMissingPriceComp(): Promise<IncomesEntity[]> {
    return this.incomesRepository
      .createQueryBuilder('incomes')
      .leftJoinAndSelect('incomes.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('incomes.priceComp IS NULL OR incomes.priceComp = 0')
      .orderBy('incomes.date', 'ASC')
      .getMany();
  }

  async updatePriceComp(id: number, priceComp: number): Promise<void> {
    await this.incomesRepository.update(id, { priceComp });
  }
}
