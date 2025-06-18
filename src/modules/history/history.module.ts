import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';

import { History } from './history.entity';
import { HistoryRepository } from './history.repository';
import { HistoryService } from './history.service';

@Module({
  imports: [TypeOrmModule.forFeature([History]), SourceModule, AssetModule],
  providers: [HistoryRepository, HistoryService],
  exports: [HistoryService, HistoryRepository],
})
export class HistoryModule {}
