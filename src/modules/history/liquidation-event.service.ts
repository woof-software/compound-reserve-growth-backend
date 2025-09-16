import { Injectable, Logger } from '@nestjs/common';

import { LiquidationEvent } from 'modules/history/entities';
import { Source } from 'modules/source/source.entity';

import { LiquidationEventRepositoryService } from './liquidation-event-repository.service';

@Injectable()
export class LiquidationEventService {
  private readonly logger = new Logger(LiquidationEventService.name);

  constructor(private readonly liquidationRepo: LiquidationEventRepositoryService) {}

  async createWithSource(liqEvent: LiquidationEvent): Promise<LiquidationEvent> {
    return this.liquidationRepo.save(liqEvent);
  }

  async findBySource(source: Source): Promise<LiquidationEvent> {
    return this.liquidationRepo.findBySourceId(source.id);
  }
}
