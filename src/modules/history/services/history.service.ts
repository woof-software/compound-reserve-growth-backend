import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { SourceRepository } from '@/modules/source/source.repository';
import { SourceEntity } from '@/modules/source/source.entity';
import { IncentiveEntity } from '@/modules/incentives/incentive.entity';
import { IncentivesQueryService } from '@/modules/incentives/incentives-query.service';
import { RevenueEntity } from '@/modules/revenue/revenue.entity';
import { RevenueService } from '@/modules/revenue/revenue.service';
import { CreateHistoryDto } from '@/modules/history/dto/create-history.dto';
import {
  IncomesEntity,
  ReserveEntity,
  SpendsEntity,
  StatsHistory,
} from '@/modules/history/entities';
import { IncomesRepository } from '@/modules/history/repositories/incomes.repository';
import { ReservesRepository } from '@/modules/history/repositories/reserves.repository';
import { SpendsRepository } from '@/modules/history/repositories/spends.repository';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { generateDailyKey } from '@/common/utils/generate-daily-key';

import { CometReserveType } from 'modules/history/enum/comet-reserve-type.enum';
import { CometReserveHistoryItem } from 'modules/history/types/comet-reserve-history-item.type';

import { NetworkService } from 'common/chains/network/network.service';

import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class HistoryService {
  constructor(
    private readonly reservesRepo: ReservesRepository,
    private readonly incomesRepo: IncomesRepository,
    private readonly spendsRepo: SpendsRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly revenueService: RevenueService,
    private readonly incentivesQueryService: IncentivesQueryService,
    private readonly networkService: NetworkService,
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
  async createReservesWithSource(
    reserve: ReserveEntity,
    manager?: EntityManager,
  ): Promise<ReserveEntity> {
    return this.reservesRepo.save(reserve, manager);
  }

  async createIncomesWithSource(
    incomes: IncomesEntity,
    manager?: EntityManager,
  ): Promise<IncomesEntity> {
    return this.incomesRepo.save(incomes, manager);
  }

  async createSpendsWithSource(
    spends: SpendsEntity,
    manager?: EntityManager,
  ): Promise<SpendsEntity> {
    return this.spendsRepo.save(spends, manager);
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

  async findIncomesBySource(
    source: SourceEntity,
    manager?: EntityManager,
  ): Promise<IncomesEntity | null> {
    return this.incomesRepo.findBySourceId(source.id, manager);
  }

  async findSpendsBySource(
    source: SourceEntity,
    manager?: EntityManager,
  ): Promise<SpendsEntity | null> {
    return this.spendsRepo.findBySourceId(source.id, manager);
  }

  async findLatestReserveBySource(
    source: SourceEntity,
    manager?: EntityManager,
  ): Promise<ReserveEntity | null> {
    return this.reservesRepo.findLatestBySourceId(source.id, manager);
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

  async getOffsetCometReserves(dto: OffsetDto): Promise<OffsetDataDto<CometReserveHistoryItem>> {
    const offsetData = await this.reservesRepo.getOffsetCometReserves(dto);

    return new OffsetDataDto<CometReserveHistoryItem>(
      offsetData.data.map((reserve) => this.mapCometReserveHistoryItem(reserve)),
      offsetData.limit,
      offsetData.offset,
      offsetData.total,
    );
  }

  async getRevenueHistory(): Promise<RevenueEntity[]> {
    const revenueHistory = await this.revenueService.getHistory();
    if (!revenueHistory || revenueHistory.length === 0) {
      throw new NotFoundException('No revenue history found');
    }
    return revenueHistory;
  }

  async getPaginatedRevenueHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<RevenueEntity>> {
    return this.revenueService.getPaginatedHistory(paginationDto);
  }

  async getOffsetRevenueHistory(dto: OffsetDto): Promise<OffsetDataDto<RevenueEntity>> {
    return this.revenueService.getOffsetHistory(dto);
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

  async getIncentiveHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentiveEntity>> {
    return this.incentivesQueryService.getOffsetHistory(dto);
  }

  private mapCometReserveHistoryItem(reserve: ReserveEntity): CometReserveHistoryItem {
    return {
      sourceAddress: reserve.source.address,
      quantity: reserve.quantity,
      value: reserve.value,
      price: reserve.price,
      chainId: this.networkService.byName(reserve.source.network)?.chainId ?? null,
      timestamp: Math.floor(reserve.date.getTime() / 1000),
      blockNumber: reserve.blockNumber,
      reserveType: reserve.source.algorithm.includes(Algorithm.COMET_COLLATERAL)
        ? CometReserveType.COLLATERAL
        : CometReserveType.MARKET,
    };
  }
}
