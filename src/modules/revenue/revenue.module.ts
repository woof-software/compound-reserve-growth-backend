import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RevenueEntity } from './revenue.entity';
import { RevenueRepository } from './revenue.repository';
import { RevenueService } from './revenue.service';

@Module({
  imports: [TypeOrmModule.forFeature([RevenueEntity])],
  providers: [RevenueRepository, RevenueService],
  exports: [RevenueService, RevenueRepository],
})
export class RevenueModule {}
