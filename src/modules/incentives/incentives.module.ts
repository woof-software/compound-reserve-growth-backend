import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IncentiveEntity } from './incentive.entity';
import { IncentivesSyncRepository } from './incentives-sync.repository';
import { IncentivesService } from './incentives.service';
import { IncentivesQueryService } from './incentives-query.service';
import { IncentivesRepository } from './incentives.repository';

@Module({
  imports: [TypeOrmModule.forFeature([IncentiveEntity])],
  providers: [
    IncentivesRepository,
    IncentivesSyncRepository,
    IncentivesQueryService,
    IncentivesService,
  ],
  exports: [
    IncentivesQueryService,
    IncentivesService,
    IncentivesRepository,
    IncentivesSyncRepository,
  ],
})
export class IncentivesModule {}
