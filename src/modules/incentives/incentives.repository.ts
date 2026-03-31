import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IncentiveEntity } from './incentive.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { Order } from '@/common/enum/order.enum';

@Injectable()
export class IncentivesRepository {
  constructor(
    @InjectRepository(IncentiveEntity)
    private readonly incentivesRepository: Repository<IncentiveEntity>,
  ) {}

  public async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentiveEntity>> {
    const order = dto.order ?? Order.DESC;
    const offset = dto.offset ?? 0;
    const query = this.incentivesRepository
      .createQueryBuilder('incentive')
      .innerJoinAndSelect('incentive.source', 'source')
      .where('source.deletedAt IS NULL')
      .orderBy('incentive.date', order)
      .addOrderBy('source.id', 'ASC')
      .addOrderBy('incentive.id', 'ASC')
      .offset(offset);

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const [items, total] = await query.getManyAndCount();

    return new OffsetDataDto<IncentiveEntity>(items, dto.limit ?? null, offset, total);
  }
}
