import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DailyAggregation } from './entities/daily.entity';
import { Snapshot } from './entities/snapshot.entity';
import { DailyAggregationRepository } from './repositories/daily-aggregation.repository';
import { SnapshotRepository } from './repositories/snapshot.repository';
import { CapoService } from './capo.service';

import { BlockModule } from '@/common/chains/block/block.module';
import { NetworkModule } from '@/common/chains/network/network.module';
import { OracleModule } from '@/modules/oracle/oracle.module';
import { AlertModule } from '@/modules/alert/alert.module';

@Module({
  imports: [
    NetworkModule,
    OracleModule,
    AlertModule,
    BlockModule,
    TypeOrmModule.forFeature([Snapshot, DailyAggregation]),
  ],
  providers: [CapoService, SnapshotRepository, DailyAggregationRepository],
})
export class CapoBackgroundModule {}
