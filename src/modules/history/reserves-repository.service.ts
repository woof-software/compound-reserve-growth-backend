import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

import { Price } from 'modules/price/price.entity';

import { IncentivesHistory, Reserve, Spends } from './entities';
import { PaginationDto } from './dto/pagination.dto';
import { OffsetDto } from './dto/offset.dto';

import { Algorithm } from '@app/common/enum/algorithm.enum';
import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Order } from '@/common/enum/order.enum';

@Injectable()
export class ReservesRepository {
  constructor(
    @InjectRepository(Reserve) private readonly reservesRepository: Repository<Reserve>,
    @InjectRepository(Spends) private readonly spendsRepository: Repository<Spends>,
    @InjectRepository(Price) private readonly priceRepository: Repository<Price>,
  ) {}

  async save(reserve: Reserve): Promise<Reserve> {
    return this.reservesRepository.save(reserve);
  }

  async findById(id: number): Promise<Reserve> {
    return this.reservesRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async getTreasuryReserves(): Promise<Reserve[]> {
    return this.reservesRepository.find({
      relations: { source: { asset: true } },
      order: { date: 'DESC' },
    });
  }

  async getTreasuryHoldings(): Promise<Reserve[]> {
    return this.reservesRepository
      .createQueryBuilder('reserves')
      .innerJoinAndSelect('reserves.source', 'source')
      .innerJoinAndSelect('source.asset', 'asset')
      .distinctOn(['source.id', 'asset.id'])
      .orderBy('source.id', 'ASC')
      .addOrderBy('asset.id', 'ASC')
      .addOrderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getPaginatedTreasuryReserves(dto: PaginationDto): Promise<PaginatedDataDto<Reserve>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset');

    query.orderBy('reserves.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [reserves, total] = await query.getManyAndCount();

    return new PaginatedDataDto<Reserve>(reserves, dto.page ?? 1, dto.perPage ?? total, total);
  }

  async getOffsetTreasuryReserves(dto: OffsetDto): Promise<OffsetDataDto<Reserve>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset');

    query.orderBy('reserves.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [reserves, total] = await query.getManyAndCount();

    return new OffsetDataDto<Reserve>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
  }

  async getRevenueReserves(): Promise<Reserve[]> {
    const algorithmsArrayLiteral = `{${[Algorithm.COMET, Algorithm.MARKET_V2].join(',')}}`;

    return this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', { algorithms: algorithmsArrayLiteral })
      .orderBy('reserves.date', 'DESC')
      .getMany();
  }

  async getPaginatedRevenueReserves(dto: PaginationDto): Promise<PaginatedDataDto<Reserve>> {
    const algorithmsArrayLiteral = `{${[
      Algorithm.COMET,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ].join(',')}}`;

    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', {
        algorithms: algorithmsArrayLiteral,
      });

    query.orderBy('reserves.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [reserves, total] = await query.getManyAndCount();

    const sourceGroups = reserves.reduce(
      (acc, item) => {
        const sourceId = item.source.id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(item);
        return acc;
      },
      {} as Record<number, Reserve[]>,
    );

    Object.values(sourceGroups).forEach((sourceReserve) => {
      sourceReserve.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 1; i < sourceReserve.length; i++) {
        const currentOriginalQuantity = BigInt(sourceReserve[i].quantity);
        const previousOriginalQuantity = BigInt(sourceReserve[i - 1].quantity);
        const difference = currentOriginalQuantity - previousOriginalQuantity;
        sourceReserve[i].value =
          Number(ethers.formatUnits(difference, sourceReserve[i].source.asset.decimals)) *
          sourceReserve[i].price;
      }
    });

    reserves.sort((a, b) => {
      const sourceComparison = a.source.id - b.source.id;
      if (sourceComparison !== 0) {
        return sourceComparison;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return new PaginatedDataDto<Reserve>(reserves, dto.page ?? 1, dto.perPage ?? total, total);
  }

  async getOffsetRevenueReserves(
    dto: OffsetDto,
    algorithms = [Algorithm.COMET, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
  ): Promise<OffsetDataDto<Reserve>> {
    const query = this.reservesRepository
      .createQueryBuilder('reserves')
      .leftJoinAndSelect('reserves.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm && :algorithms::text[]', {
        algorithms: `{${algorithms.join(',')}}`,
      });

    query.orderBy('reserves.date', dto.order).offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [reserves, total] = await query.getManyAndCount();

    const sourceGroups = reserves.reduce(
      (acc, item) => {
        const sourceId = item.source.id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(item);
        return acc;
      },
      {} as Record<number, Reserve[]>,
    );

    Object.values(sourceGroups).forEach((sourceReserve) => {
      sourceReserve.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 1; i < sourceReserve.length; i++) {
        const currentOriginalQuantity = BigInt(sourceReserve[i].quantity);
        const previousOriginalQuantity = BigInt(sourceReserve[i - 1].quantity);
        const difference = currentOriginalQuantity - previousOriginalQuantity;
        sourceReserve[i].value =
          Number(ethers.formatUnits(difference, sourceReserve[i].source.asset.decimals)) *
          sourceReserve[i].price;
      }
    });

    reserves.sort((a, b) => {
      const sourceComparison = a.source.id - b.source.id;
      if (sourceComparison !== 0) {
        return sourceComparison;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return new OffsetDataDto<Reserve>(reserves, dto.limit ?? null, dto.offset ?? 0, total);
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

  async getOffsetIncentivesHistory(
    dto: OffsetDto,
    algorithms = [Algorithm.COMET_STATS, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
  ): Promise<OffsetDataDto<IncentivesHistory>> {
    const { order = Order.ASC } = dto;

    // Subquery S: pick latest spends per (sourceId, date)
    const sSub = this.spendsRepository.createQueryBuilder('s').select([
      's."sourceId" AS "sourceId"',
      's."date" AS "date"',
      's."valueSupply" AS "valueSupply"',
      's."valueBorrow" AS "valueBorrow"',
      's."priceComp" AS "priceComp"',
      // pick the latest by created_at (fallback id)
      `ROW_NUMBER() OVER (
       PARTITION BY s."sourceId", s."date"
       ORDER BY s."createdAt" DESC, s."id" DESC
     ) AS rn`,
    ]);

    // Subquery P: one price per (symbol, date) for COMP (latest if duplicates)
    // !: equality join on date;
    const pSub = this.priceRepository
      .createQueryBuilder('p')
      .select([
        `p."symbol" AS "symbol"`,
        `p."date"   AS "date"`,
        `p."price"  AS "price"`,
        `ROW_NUMBER() OVER (
         PARTITION BY p."symbol", p."date"
         ORDER BY p."createdAt" DESC, p."id" DESC
       ) AS rn`,
      ])
      .where('p."symbol" = :comp', { comp: 'COMP' });

    // Data QB: merged rows (reserves + latest spends)
    const dataQb = this.reservesRepository
      .createQueryBuilder('r')
      .innerJoin('r.source', 'src')
      // latest spends per (sourceId,date)
      .leftJoin(
        `(${sSub.getQuery()})`,
        'ls',
        `ls."sourceId" = r."sourceId" AND ls."date" = r."date" AND ls.rn = 1`,
      )
      // one COMP price per date
      .leftJoin(`(${pSub.getQuery()})`, 'cp', `cp."date" = r."date" AND cp.rn = 1`)
      .setParameters(sSub.getParameters())
      .setParameters(pSub.getParameters())
      .where('src.algorithm && :algorithms::text[]', { algorithms })
      .select([
        'r."sourceId" AS "sourceId"',
        'r."date" AS "date"',
        'r."value" AS "incomes"',
        'COALESCE(ls."valueSupply", 0) AS "rewardsSupply"',
        'COALESCE(ls."valueBorrow", 0) AS "rewardsBorrow"',
        // Fallback: ls.priceComp -> cp.price -> 0
        `COALESCE(ls."priceComp", cp."price", 0) AS "priceComp"`,
      ])
      .orderBy('r."date"', order)
      .offset(dto.offset ?? 0);

    if (dto.limit) dataQb.limit(dto.limit);

    // Count QB: count ONLY reserves under the same filter (no joins to spends)
    const countQb = this.reservesRepository
      .createQueryBuilder('r')
      .innerJoin('r.source', 'src')
      .where('src.algorithm && :algorithms::text[]', { algorithms });

    const [rows, totalReserves] = await Promise.all([
      dataQb.getRawMany<IncentivesHistory>(),
      countQb.getCount(),
    ]);

    return new OffsetDataDto<IncentivesHistory>(
      rows,
      dto.limit ?? null,
      dto.offset ?? 0,
      totalReserves,
    );
  }
}
