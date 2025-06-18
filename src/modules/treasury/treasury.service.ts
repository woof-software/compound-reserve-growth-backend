import { Injectable, NotFoundException } from '@nestjs/common';

import { SourceRepository } from 'modules/source/source.repository';
import { AssetRepository } from 'modules/asset/asset.repository';

import { TreasuryRepository } from './treasury.repository';
import { Treasury } from './treasury.entity';
import { CreateTreasuryDto } from './dto/create-treasury.dto';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly treasuryRepo: TreasuryRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly assetRepo: AssetRepository,
  ) {}

  async create(dto: CreateTreasuryDto): Promise<Treasury> {
    const source = await this.sourceRepo.findById(dto.sourceId);
    if (!source) throw new NotFoundException(`Source ${dto.sourceId} not found`);
    const asset = await this.assetRepo.findById(dto.assetId);
    if (!asset) throw new NotFoundException(`Asset ${dto.assetId} not found`);
    const treasury = new Treasury(
      source,
      asset,
      dto.blockNumber,
      dto.quantity,
      dto.price,
      dto.value,
      dto.date,
    );
    return this.treasuryRepo.save(treasury);
  }

  async findById(id: number): Promise<Treasury> {
    return this.treasuryRepo.findById(id);
  }
}
