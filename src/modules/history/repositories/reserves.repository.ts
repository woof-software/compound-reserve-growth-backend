import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReserveEntity } from 'modules/history/entities';
import { PaginationDto } from 'modules/history/dto/pagination.dto';
import { OffsetDto } from 'modules/history/dto/offset.dto';

import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';

@Injectable()
export class ReservesRepository {
  constructor(
    @InjectRepository(ReserveEntity) private readonly reservesRepository: Repository<ReserveEntity>,
  ) {}

  async save(reserve: ReserveEntity): Promise<ReserveEntity> {
    return this.reservesRepository.save(reserve);
  }

  async findById(id: number): Promise<ReserveEntity | null> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .where('source.deletedAt IS NULL')
      .andWhere('reserves.id = :id', { id })
      .getOne();
  }

  async findLatestBySourceId(sourceId: number): Promise<ReserveEntity | null> {
    return this.reservesRepository
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

  async deleteAll(): Promise<void> {
    await this.reservesRepository.clear();
  }

  async deleteBySourceIds(sourceIds: number[]): Promise<void> {
    if (sourceIds.length === 0) {
      return;
    }
    await this.reservesRepository
      .createQueryBuilder()
      .delete()
      .where('sourceId IN (:...sourceIds)', { sourceIds })
      .execute();
  }
}
