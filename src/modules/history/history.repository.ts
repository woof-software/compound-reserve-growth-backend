import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { History } from './history.entity';
import { PaginationDto } from './dto/pagination.dto';

import { Algorithm } from '@app/common/enum/algorithm.enum';
import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';

@Injectable()
export class HistoryRepository {
  constructor(@InjectRepository(History) private readonly historyRepository: Repository<History>) {}

  async save(history: History): Promise<History> {
    return this.historyRepository.save(history);
  }

  async findById(id: number): Promise<History> {
    return this.historyRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async getTreasuryHistory(): Promise<History[]> {
    return this.historyRepository.find({
      relations: { source: { asset: true } },
      order: { date: 'DESC' },
    });
  }

  async getTreasuryHoldings(): Promise<History[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .innerJoinAndSelect('history.source', 'source')
      .innerJoinAndSelect('source.asset', 'asset')
      .distinctOn(['source.id', 'asset.id'])
      .orderBy('source.id', 'ASC')
      .addOrderBy('asset.id', 'ASC')
      .addOrderBy('history.date', 'DESC')
      .getMany();
  }

  async getPaginatedTreasuryHistory(dto: PaginationDto): Promise<PaginatedDataDto<History>> {
    const query = this.historyRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset');

    query.orderBy('history.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [history, total] = await query.getManyAndCount();

    return new PaginatedDataDto<History>(history, dto.page ?? 1, dto.perPage ?? total, total);
  }

  async getRevenueHistory(): Promise<History[]> {
    return this.historyRepository.find({
      where: {
        source: {
          algorithm: In([Algorithm.COMET, Algorithm.MARKET_V2]),
        },
      },
      relations: { source: { asset: true } },
      order: { date: 'DESC' },
    });
  }

  async getPaginatedRevenueHistory(dto: PaginationDto): Promise<PaginatedDataDto<History>> {
    const query = this.historyRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.source', 'source')
      .leftJoinAndSelect('source.asset', 'asset')
      .where('source.algorithm IN (:...algorithms)', {
        algorithms: [Algorithm.COMET, Algorithm.MARKET_V2],
      });

    query.orderBy('history.date', dto.order);

    if (dto.perPage) {
      const skip = (dto.page - 1) * dto.perPage;
      query.skip(skip).take(dto.perPage);
    }

    const [history, total] = await query.getManyAndCount();

    const sourceGroups = history.reduce(
      (acc, item) => {
        const sourceId = item.source.id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(item);
        return acc;
      },
      {} as Record<number, History[]>,
    );

    Object.values(sourceGroups).forEach((sourceHistory) => {
      sourceHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const originalValues = sourceHistory.map((item) => item.value);
      for (let i = 1; i < sourceHistory.length; i++) {
        const currentOriginal = originalValues[i];
        const previousOriginal = originalValues[i - 1];
        const difference = currentOriginal - previousOriginal;
        sourceHistory[i].value = difference;
      }
    });

    history.sort((a, b) => {
      const sourceComparison = a.source.id - b.source.id;
      if (sourceComparison !== 0) {
        return sourceComparison;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return new PaginatedDataDto<History>(history, dto.page ?? 1, dto.perPage ?? total, total);
  }
}
