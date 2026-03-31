import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { RevenueEntity } from './revenue.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Order } from '@/common/enum/order.enum';

@Injectable()
export class RevenueRepository {
  constructor(
    @InjectRepository(RevenueEntity) private readonly revenueRepository: Repository<RevenueEntity>,
  ) {}

  async listAll(): Promise<RevenueEntity[]> {
    return this.createRevenueQuery(true)
      .orderBy('revenue.date', 'DESC')
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC')
      .getMany();
  }

  async findById(id: number): Promise<RevenueEntity | null> {
    return this.createRevenueQuery(true).where('revenue.id = :id', { id }).getOne();
  }

  async getPaginatedHistory(dto: PaginationDto): Promise<PaginatedDataDto<RevenueEntity>> {
    const order = dto.order ?? Order.DESC;
    const page = dto.page ?? 1;
    const query = this.createRevenueQuery(true)
      .orderBy('revenue.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC');

    if (dto.perPage) {
      query.skip((page - 1) * dto.perPage).take(dto.perPage);
    }

    const [items, total] = await query.getManyAndCount();

    return new PaginatedDataDto<RevenueEntity>(items, page, dto.perPage ?? total, total);
  }

  async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<RevenueEntity>> {
    const order = dto.order ?? Order.DESC;
    const offset = dto.offset ?? 0;
    const query = this.createRevenueQuery(false)
      .orderBy('revenue.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('revenue.id', 'ASC')
      .offset(offset);

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const [items, total] = await query.getManyAndCount();

    return new OffsetDataDto<RevenueEntity>(items, dto.limit ?? null, offset, total);
  }

  private createRevenueQuery(withAsset: boolean): SelectQueryBuilder<RevenueEntity> {
    const query = this.revenueRepository
      .createQueryBuilder('revenue')
      .innerJoinAndSelect('revenue.source', 'source')
      .where('source.deletedAt IS NULL');

    if (withAsset) {
      query.innerJoinAndSelect('source.asset', 'asset');
    }

    return query;
  }
}
