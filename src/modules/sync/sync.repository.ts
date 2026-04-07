import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Algorithm } from '@/common/enum/algorithm.enum';
import { ReserveEntity } from '@/modules/history/entities';
import { SyncReservesQuery } from '@/modules/sync/types/sync-reserves-query.type';

@Injectable()
export class SyncRepository {
  constructor(
    @InjectRepository(ReserveEntity) private readonly reservesRepository: Repository<ReserveEntity>,
  ) {}

  async listCometReserves(queryArgs: SyncReservesQuery): Promise<ReserveEntity[]> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET, Algorithm.COMET_COLLATERAL].join(',')}}`;
    const query = this.reservesRepository
      .createQueryBuilder('reserve')
      .innerJoinAndSelect('reserve.source', 'source')
      .innerJoinAndSelect('source.asset', 'asset')
      .select([
        'reserve.id',
        'reserve.blockNumber',
        'reserve.quantity',
        'reserve.price',
        'reserve.value',
        'reserve.date',
        'reserve.updatedAt',
        'source.id',
        'source.address',
        'source.network',
        'source.algorithm',
        'asset.id',
        'asset.address',
        'asset.decimals',
        'asset.symbol',
      ])
      .where('source.deletedAt IS NULL')
      .andWhere('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      })
      .orderBy('reserve.updatedAt', 'ASC')
      .addOrderBy('reserve.id', 'ASC')
      .limit(queryArgs.limit);

    if (queryArgs.cursorUpdatedAt && queryArgs.cursorId) {
      query.andWhere(
        '(reserve.updatedAt > :cursorUpdatedAt OR (reserve.updatedAt = :cursorUpdatedAt AND reserve.id > :cursorId))',
        {
          cursorUpdatedAt: queryArgs.cursorUpdatedAt,
          cursorId: queryArgs.cursorId,
        },
      );
    } else if (queryArgs.cursorUpdatedAt) {
      query.andWhere('reserve.updatedAt > :cursorUpdatedAt', {
        cursorUpdatedAt: queryArgs.cursorUpdatedAt,
      });
    }

    return query.getMany();
  }
}
