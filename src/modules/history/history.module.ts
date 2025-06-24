import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { ContractModule } from 'modules/contract/contract.module';

import { History } from './history.entity';
import { HistoryRepository } from './history.repository';
import { HistoryService } from './history.service';
import { HistoryGetCommand } from './cli/history-get.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([History]),
    SourceModule,
    AssetModule,
    forwardRef(() => ContractModule),
  ],
  providers: [HistoryRepository, HistoryService, HistoryGetCommand],
  exports: [HistoryService, HistoryRepository],
})
export class HistoryModule {}
