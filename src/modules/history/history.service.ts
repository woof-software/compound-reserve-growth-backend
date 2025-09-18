import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { Source } from 'modules/source/source.entity';

import { ReservesRepository } from './reserves-repository.service';
import { IncomesRepository } from './incomes-repository.service';
import { SpendsRepository } from './spends-repository.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { Reserve, Incomes, Spends, StatsHistory } from './entities';
import { PaginationDto } from './dto/pagination.dto';
import { OffsetDto } from './dto/offset.dto';

import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';

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

    // Create a map to group incomes and spends by date and source
    const statsMap = new Map<string, StatsHistory>();

    // Process incomes data
    incomesData.data.forEach((income) => {
      const key = `${income.date.getTime()}-${income.source.id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          incomes: {
            id: income.id,
            valueSupply: income.valueSupply,
            valueBorrow: income.valueBorrow,
            date: income.date,
          },
          sourceId: income.source.id,
        });
      } else {
        const existing = statsMap.get(key)!;
        existing.incomes = {
          id: income.id,
          valueSupply: income.valueSupply,
          valueBorrow: income.valueBorrow,
          date: income.date,
        };
      }
    });

    // Process spends data
    spendsData.data.forEach((spend) => {
      const key = `${spend.date.getTime()}-${spend.source.id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          incomes: {
            id: 0,
            valueSupply: 0,
            valueBorrow: 0,
            date: spend.date,
          },
          spends: {
            id: spend.id,
            valueSupply: spend.valueSupply,
            valueBorrow: spend.valueBorrow,
            date: spend.date,
          },
          sourceId: spend.source.id,
        });
      } else {
        const existing = statsMap.get(key)!;
        existing.spends = {
          id: spend.id,
          valueSupply: spend.valueSupply,
          valueBorrow: spend.valueBorrow,
          date: spend.date,
        };
      }
    });

    // Convert map to array and sort by date
    const statsHistory = Array.from(statsMap.values()).sort((a, b) => {
      // Use incomes date for sorting, fallback to spends date if incomes id is 0
      const dateA = a.incomes.id === 0 && a.spends ? a.spends.date : a.incomes.date;
      const dateB = b.incomes.id === 0 && b.spends ? b.spends.date : b.incomes.date;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
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
}
