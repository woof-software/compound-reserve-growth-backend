import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { AssetRepository } from 'modules/asset/asset.repository';

import { HistoryRepository } from './history.repository';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './history.entity';

@Injectable()
export class HistoryService {
  constructor(
    private readonly historyRepo: HistoryRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly assetRepo: AssetRepository,
  ) {}

  async create(dto: CreateHistoryDto): Promise<History> {
    const source = await this.sourceRepo.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);
    const asset = await this.assetRepo.findById(dto.assetId);
    if (!asset) throw new NotFoundException(`Asset ${dto.assetId} not found`);
    const history = new History(
      source,
      asset,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.historyRepo.save(history);
  }

  async findById(id: number): Promise<History> {
    return this.historyRepo.findById(id);
  }
}
