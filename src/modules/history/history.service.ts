import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { Source } from 'modules/source/source.entity';

import { ReservesRepository } from './reserves-repository.service';
import { IncomesRepository } from './incomes-repository.service';
import { SpendsRepository } from './spends-repository.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { Reserve, Incomes, Spends, StatsHistory, IncentivesHistory } from './entities';
import { PaginationDto } from './dto/pagination.dto';
import { OffsetDto } from './dto/offset.dto';

import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';

const msInDay = 86400000;
const dayId = (date: Date): number => Math.floor(date.getTime() / msInDay);
const generateDailyKey = (sourceId: number, date: Date): string => `${sourceId}_${dayId(date)}`;

@Injectable()
export class HistoryService {
  constructor(
    private readonly reservesRepo: ReservesRepository,
    private readonly incomesRepo: IncomesRepository,
    private readonly spendsRepo: SpendsRepository,
    private readonly sourceRepo: SourceRepository,
  ) {}

  async create(dto: CreateHistoryDto): Promise<Reserve> {
    const source = await this.sourceRepo.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);

    const reserve = new Reserve(
      source,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.reservesRepo.save(reserve);
  }
  async createReservesWithSource(reserve: Reserve): Promise<Reserve> {
    return this.reservesRepo.save(reserve);
  }

  async createIncomesWithSource(incomes: Incomes): Promise<Incomes> {
    return this.incomesRepo.save(incomes);
  }

  async createSpendsWithSource(spends: Spends): Promise<Spends> {
    return this.spendsRepo.save(spends);
  }

  async findReservesById(id: number): Promise<Reserve> {
    return this.reservesRepo.findById(id);
  }

  async findIncomesById(id: number): Promise<Incomes> {
    return this.incomesRepo.findById(id);
  }

  async findSpendsById(id: number): Promise<Spends> {
    return this.spendsRepo.findById(id);
  }

  async findIncomesBySource(source: Source): Promise<Incomes> {
    return this.incomesRepo.findBySourceId(source.id);
  }

  async findSpendsBySource(source: Source): Promise<Spends> {
    return this.spendsRepo.findBySourceId(source.id);
  }

  async getTreasuryHistory(): Promise<Reserve[]> {
    const reserves = await this.reservesRepo.getTreasuryReserves();
    if (!reserves || reserves.length === 0) {
      throw new NotFoundException('No treasury history found');
    }
    return reserves;
  }

  async getPaginatedTreasuryHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<Reserve>> {
    return this.reservesRepo.getPaginatedTreasuryReserves(paginationDto);
  }

  async getOffsetTreasuryHistory(dto: OffsetDto): Promise<OffsetDataDto<Reserve>> {
    return this.reservesRepo.getOffsetTreasuryReserves(dto);
  }

  async getRevenueHistory(): Promise<Reserve[]> {
    const reserves = await this.reservesRepo.getRevenueReserves();
    if (!reserves || reserves.length === 0) {
      throw new NotFoundException('No revenue history found');
    }
    return reserves;
  }

  async getPaginatedRevenueHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<Reserve>> {
    return this.reservesRepo.getPaginatedRevenueReserves(paginationDto);
  }

  async getOffsetRevenueHistory(dto: OffsetDto): Promise<OffsetDataDto<Reserve>> {
    return this.reservesRepo.getOffsetRevenueReserves(dto);
  }

  async getTreasuryHoldings(): Promise<Reserve[]> {
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
    const spendsMap = new Map<string, Spends>();
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
    const [revenue, spends] = await Promise.all([
      this.getOffsetRevenueHistory(dto),
      this.spendsRepo.getOffsetStats(dto),
    ]);

    // Create a Map for quick lookup of revenue by sourceId and date
    const revenueMap = new Map<string, Reserve>();
    revenue.data.forEach((item) => {
      const key = generateDailyKey(item.source.id, item.date);
      revenueMap.set(key, item);
    });

    const data: IncentivesHistory[] = spends.data.map((spend) => {
      const revenueRecord = revenueMap.get(generateDailyKey(spend.source.id, spend.date));
      return {
        incomes: revenueRecord?.value ?? 0,
        rewardsSupply: spend.valueSupply,
        rewardsBorrow: spend.valueBorrow,
        sourceId: spend.source.id,
        priceComp: spend.priceComp,
        date: spend.date,
      };
    });

    return new OffsetDataDto<IncentivesHistory>(data, spends.limit, spends.offset, spends.total);
  }
}
