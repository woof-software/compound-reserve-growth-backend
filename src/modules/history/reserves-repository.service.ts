import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

import { Reserve } from './entities';
import { PaginationDto } from './dto/pagination.dto';
import { OffsetDto } from './dto/offset.dto';

import { Algorithm } from '@app/common/enum/algorithm.enum';
import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';

@Injectable()
export class ReservesRepository {
  constructor(
    @InjectRepository(Reserve) private readonly reservesRepository: Repository<Reserve>,
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

  async getOffsetRevenueReserves(dto: OffsetDto): Promise<OffsetDataDto<Reserve>> {
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
}
