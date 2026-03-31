import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ReserveEntity } from '@/modules/history/entities';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class ReservesRepository {
  constructor(
    @InjectRepository(ReserveEntity) private readonly reservesRepository: Repository<ReserveEntity>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<ReserveEntity> {
    return manager?.getRepository(ReserveEntity) ?? this.reservesRepository;
  }

  async save(reserve: ReserveEntity, manager?: EntityManager): Promise<ReserveEntity> {
    return this.getRepository(manager).save(reserve);
  }

  async findById(id: number): Promise<ReserveEntity | null> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('reserves.id = :id', { id })
      .getOne();
  }

  async findLatestBySourceId(
    sourceId: number,
    manager?: EntityManager,
  ): Promise<ReserveEntity | null> {
    return this.getRepository(manager)
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('source.id = :sourceId', { sourceId })
      .orderBy('reserves.blockNumber', 'DESC')
      .getOne();
  }

  async getTreasuryReserves(): Promise<ReserveEntity[]> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .orderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getTreasuryHoldings(): Promise<ReserveEntity[]> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .innerJoinAndSelect('reserves.source', 'source')
      .innerJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL')
      .distinctOn(['source.id', 'asset.id'])
      .orderBy('source.id', 'ASC')
      .addOrderBy('asset.id', 'ASC')
      .addOrderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getPaginatedTreasuryReserves(dto: PaginationDto): Promise<PaginatedDataDto<ReserveEntity>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL');

    query.orderBy('reserves.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [reserves, total] = await query.getManyAndCount();

    return new PaginatedDataDto<ReserveEntity>(
      reserves,
      dto.page ?? 1,
      dto.perPage ?? total,
      total,
    );
  }

  async getOffsetCometReserves(dto: OffsetDto): Promise<OffsetDataDto<ReserveEntity>> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET, Algorithm.COMET_COLLATERAL].join(',')}}`;
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      })
      .orderBy('reserves.date', dto.order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('reserves.id', 'ASC')
      .offset(dto.offset ?? 0);

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const [reserves, total] = await query.getManyAndCount();

    return new OffsetDataDto<ReserveEntity>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async getOffsetTreasuryReserves(dto: OffsetDto): Promise<OffsetDataDto<ReserveEntity>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.deletedAt IS NULL');

    query.orderBy('reserves.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [reserves, total] = await query.getManyAndCount();

    return new OffsetDataDto<ReserveEntity>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async deleteAll(manager?: EntityManager): Promise<void> {
    await this.getRepository(manager).clear();
  }

  async deleteBySourceIds(sourceIds: number[], manager?: EntityManager): Promise<void> {
    if (sourceIds.length === 0) {
      return;
    }
    await this.getRepository(manager)
      .createQueryBuilder()
      .delete()
      .where('sourceId IN (:...sourceIds)', { sourceIds })
      .execute();
  }
}
