import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';

import { HistoryRepository } from './history.repository';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './history.entity';
import { PaginationDto } from './dto/pagination.dto';

import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';

@Injectable()
export class HistoryService {
  constructor(
    private readonly historyRepo: HistoryRepository,
    private readonly sourceRepo: SourceRepository,
  ) {}

  async create(dto: CreateHistoryDto): Promise<History> {
    const source = await this.sourceRepo.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);

    const history = new History(
      source,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.historyRepo.save(history);
  }
  async createWithSource(history: History): Promise<History> {
    return this.historyRepo.save(history);
  }

  async findById(id: number): Promise<History> {
    return this.historyRepo.findById(id);
  }

  async getTreasuryHistory(): Promise<History[]> {
    const history = await this.historyRepo.getTreasuryHistory();
    if (!history || history.length === 0) {
      throw new NotFoundException('No treasury history found');
    }
    return history;
  }

  async getPaginatedTreasuryHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<History>> {
    return this.historyRepo.getPaginatedTreasuryHistory(paginationDto);
  }

  async getRevenueHistory(): Promise<History[]> {
    const history = await this.historyRepo.getRevenueHistory();
    if (!history || history.length === 0) {
      throw new NotFoundException('No revenue history found');
    }
    return history;
  }

  async getPaginatedRevenueHistory(
    paginationDto: PaginationDto,
  ): Promise<PaginatedDataDto<History>> {
    return this.historyRepo.getPaginatedRevenueHistory(paginationDto);
  }

  async getTreasuryHoldings(): Promise<History[]> {
    const holdings = await this.historyRepo.getTreasuryHoldings();
    if (!holdings || holdings.length === 0) {
      throw new NotFoundException('No treasury holdings found');
    }
    return holdings;
  }
}
