import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LiquidationEvent } from 'modules/history/entities';
import { OffsetDto } from 'modules/history/dto/offset.dto';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';

@Injectable()
export class LiquidationEventRepositoryService {
  constructor(
    @InjectRepository(LiquidationEvent)
    private readonly liquidationEventRepository: Repository<LiquidationEvent>,
  ) {}

  async save(liqEvent: LiquidationEvent): Promise<LiquidationEvent> {
    return this.liquidationEventRepository.save(liqEvent);
  }

  async findById(id: number): Promise<LiquidationEvent> {
    return this.liquidationEventRepository.findOne({
      where: { id },
      relations: { source: true },
    });
  }

  async findBySourceId(sourceId: number): Promise<LiquidationEvent> {
    return this.liquidationEventRepository.findOne({
      where: { source: { id: sourceId } },
      relations: { source: true },
      order: { blockNumber: 'DESC' },
    });
  }

  async getOffset(dto: OffsetDto): Promise<OffsetDataDto<LiquidationEvent>> {
    const query = this.liquidationEventRepository.createQueryBuilder('liquidation_event');

    query
      .leftJoinAndSelect('liquidation_event.source', 'source')
      .orderBy('liquidation_event.date', dto.order)
      .offset(dto.offset ?? 0);

    if (dto.limit) query.limit(dto.limit);

    const [liqEvent, total] = await query.getManyAndCount();

    return new OffsetDataDto<LiquidationEvent>(liqEvent, dto.limit ?? null, dto.offset ?? 0, total);
  }
}
