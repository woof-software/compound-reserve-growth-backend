import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SourceModule } from 'modules/source/source.module';

import { Revenue } from './revenue.entity';
import { RevenueRepository } from './revenue.repository';
import { RevenueService } from './revenue.service';

@Module({
  imports: [TypeOrmModule.forFeature([Revenue]), SourceModule],
  providers: [RevenueRepository, RevenueService],
  exports: [RevenueService, RevenueRepository],
})
export class RevenueModule {}
