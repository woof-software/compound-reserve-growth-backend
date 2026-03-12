import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { SourceEntity } from 'modules/source/source.entity';

import { ReservesRepository } from '../repositories/reserves.repository';
import { IncomesRepository } from '../repositories/incomes.repository';
import { SpendsRepository } from '../repositories/spends.repository';
import { CreateHistoryDto } from '../dto/create-history.dto';
import {
  ReserveEntity,
  IncomesEntity,
  SpendsEntity,
  StatsHistory,
  IncentivesHistory,
} from '../entities';
import { PaginationDto } from '../dto/pagination.dto';
import { OffsetDto } from '../dto/offset.dto';

import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Algorithm } from '@/common/enum/algorithm.enum';
import { Order } from '@/common/enum/order.enum';
import { generateDailyKey } from '@/common/utils/generate-daily-key';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    private readonly reservesRepo: ReservesRepository,
    private readonly incomesRepo: IncomesRepository,
    private readonly spendsRepo: SpendsRepository,
    private readonly sourceRepo: SourceRepository,
  ) {}

  async create(dto: CreateHistoryDto): Promise<ReserveEntity> {
    const source = await this.sourceRepo.findById(dto.sourceId);
    if (!source) {
      throw new NotFoundException(`Source ${dto.sourceId} not found`);
    }

    const reserve = new ReserveEntity(
      source,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.reservesRepo.save(reserve);
  }
  async createReservesWithSource(reserve: ReserveEntity): Promise<ReserveEntity> {
    return this.reservesRepo.save(reserve);
  }

  async createIncomesWithSource(incomes: IncomesEntity): Promise<IncomesEntity> {
    return this.incomesRepo.save(incomes);
  }

  async createSpendsWithSource(spends: SpendsEntity): Promise<SpendsEntity> {
    return this.spendsRepo.save(spends);
  }

  async findReservesById(id: number): Promise<ReserveEntity | null> {
    return this.reservesRepo.findById(id);
  }

  async findIncomesById(id: number): Promise<IncomesEntity | null> {
    return this.incomesRepo.findById(id);
  }

  async findSpendsById(id: number): Promise<SpendsEntity | null> {
    return this.spendsRepo.findById(id);
  }

  async findIncomesBySource(source: SourceEntity): Promise<IncomesEntity | null> {
    return this.incomesRepo.findBySourceId(source.id);
  }

  async findSpendsBySource(source: SourceEntity): Promise<SpendsEntity | null> {
    return this.spendsRepo.findBySourceId(source.id);
  }

  async findLatestReserveBySource(source: SourceEntity): Promise<ReserveEntity | null> {
    return this.reservesRepo.findLatestBySourceId(source.id);
  }

  async getTreasuryHistory(): Promise<ReserveEntity[]> {
    const reserves = await this.reservesRepo.getTreasuryReserves();
    if (!reserves || reserves.length === 0) {
      throw new NotFoundException('No treasury history found');
    }
    return reserves;
  }

  async getPaginatedTreasuryHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<ReserveEntity>> {
    return this.reservesRepo.getPaginatedTreasuryReserves(paginationDto);
  }

  async getOffsetTreasuryHistory(dto: OffsetDto): Promise<OffsetDataDto<ReserveEntity>> {
    return this.reservesRepo.getOffsetTreasuryReserves(dto);
  }

  async getRevenueHistory(): Promise<ReserveEntity[]> {
    const reserves = await this.reservesRepo.getRevenueReserves();
    if (!reserves || reserves.length === 0) {
      throw new NotFoundException('No revenue history found');
    }
    return reserves;
  }

  async getPaginatedRevenueHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<ReserveEntity>> {
    return this.reservesRepo.getPaginatedRevenueReserves(paginationDto);
  }

  async getOffsetRevenueHistory(dto: OffsetDto): Promise<OffsetDataDto<ReserveEntity>> {
    return this.reservesRepo.getOffsetRevenueReserves(dto);
  }

  async getTreasuryHoldings(): Promise<ReserveEntity[]> {
    const holdings = await this.reservesRepo.getTreasuryHoldings();
    if (!holdings || holdings.length === 0) {
      throw new NotFoundException('No treasury holdings found');
    }
    return holdings;
  }

  async getOffsetStatsHistory(dto: OffsetDto): Promise<OffsetDataDto<StatsHistory>> {
    // Get all data without offset/limit first to properly merge and calculate total
    const [incomesData, spendsData] = await Promise.all([
      this.incomesRepo.getOffsetStats(new OffsetDto(undefined, 0, dto.order)),
      this.spendsRepo.getOffsetStats(new OffsetDto(undefined, 0, dto.order)),
    ]);

    // Create a Map for quick lookup of spends by sourceId and date
    const spendsMap = new Map<string, SpendsEntity>();
    spendsData.data.forEach((spData) => {
      const key = generateDailyKey(spData.source.id, spData.date);
      spendsMap.set(key, spData);
    });

    // Process incomes data
    const rawStats: StatsHistory[] = incomesData.data.map((incData) => {
      const key = generateDailyKey(incData.source.id, incData.date);
      const spData = spendsMap.get(key);
      let spends = undefined;
      if (spData) {
        spends = {
          id: spData.id,
          valueSupply: spData.valueSupply,
          valueBorrow: spData.valueBorrow,
        };
      }

      return {
        incomes: {
          id: incData.id,
          valueSupply: incData.valueSupply,
          valueBorrow: incData.valueBorrow,
        },
        spends,
        sourceId: incData.source.id,
        priceComp: incData.priceComp,
        date: incData.date,
      };
    });
    const statsHistory = rawStats.sort((a, b) => {
      return dto.order === 'ASC'
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Apply offset and limit to the merged and sorted data
    const total = statsHistory.length;
    const offset = dto.offset ?? 0;
    const limit = dto.limit;

    const paginatedData = limit
      ? statsHistory.slice(offset, offset + limit)
      : statsHistory.slice(offset);

    return new OffsetDataDto<StatsHistory>(
      paginatedData,
      dto.limit ?? null,
      dto.offset ?? 0,
      total,
    );
  }

  async getIncentiveHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentivesHistory>> {
    const allAlgorithms = [
      Algorithm.COMET_STATS,
      Algorithm.MARKET_V2,
      Algorithm.AERA_COMPOUND_RESERVES,
    ];

    if (!dto.order) {
      dto.order = Order.ASC;
    }

    const incentivesData = await this.reservesRepo.getOffsetIncentivesHistory(dto, allAlgorithms);

    if (incentivesData.data.length === 0) {
      return new OffsetDataDto<IncentivesHistory>(
        [],
        incentivesData.limit,
        incentivesData.offset,
        incentivesData.total,
      );
    }

    const indexesWithoutPrice: number[] = [];
    let firstPrice = 0;
    let previousPrice = 0;
    const data: IncentivesHistory[] = incentivesData.data.map((item, index) => {
      if (!item.priceComp) {
        this.logger.warn(`incentives -> priceComp not found for ${item.date}`, item);
        if (previousPrice) {
          item.priceComp = previousPrice;
        } else {
          indexesWithoutPrice.push(index);
        }
      } else {
        firstPrice = firstPrice || item.priceComp;
        previousPrice = item.priceComp;
      }
      return item;
    });

    if (firstPrice) {
      indexesWithoutPrice.forEach((index) => {
        data[index].priceComp = firstPrice;
      });
    }

    return new OffsetDataDto<IncentivesHistory>(
      data,
      incentivesData.limit,
      incentivesData.offset,
      incentivesData.total,
    );
  }
}
