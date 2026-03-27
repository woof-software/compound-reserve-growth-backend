import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IncentiveEntity } from './incentive.entity';
import { IncentivesService } from './incentives.service';
import { IncentivesQueryService } from './incentives-query.service';
import { IncentivesRepository } from './incentives.repository';

@Module({
  imports: [TypeOrmModule.forFeature([IncentiveEntity])],
  providers: [IncentivesRepository, IncentivesQueryService, IncentivesService],
  exports: [IncentivesQueryService, IncentivesService, IncentivesRepository],
})
export class IncentivesModule {}
