import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RevenueEntity } from './revenue.entity';
import { RevenueSyncRepository } from './revenue-sync.repository';
import { RevenueRepository } from './revenue.repository';
import { RevenueService } from './revenue.service';

@Module({
  imports: [TypeOrmModule.forFeature([RevenueEntity])],
  providers: [RevenueRepository, RevenueSyncRepository, RevenueService],
  exports: [RevenueService, RevenueRepository, RevenueSyncRepository],
})
export class RevenueModule {}
