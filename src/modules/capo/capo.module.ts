import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CapoController } from './capo.controller';
import { CapoQueryService } from './capo-query.service';
import { DailyAggregation } from './entities/daily.entity';
import { Snapshot } from './entities/snapshot.entity';
import { DailyAggregationRepository } from './repositories/daily-aggregation.repository';
import { SnapshotRepository } from './repositories/snapshot.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Snapshot, DailyAggregation])],
  controllers: [CapoController],
  providers: [CapoQueryService, SnapshotRepository, DailyAggregationRepository],
  exports: [],
})
export class CapoModule {}
