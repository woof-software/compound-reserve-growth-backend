import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { ContractModule } from 'modules/contract/contract.module';
import { PriceModule } from 'modules/price/price.module';

import { ReserveEntity, IncomesEntity, SpendsEntity } from './entities';
import { HistoryGetCommand } from './cli/history-get.command';
import { StatsGetCommand } from './cli/stats-get.command';
import { HistoryController } from './history.controller';
import { HistoryCollectionQueueService } from './queue/history-collection-queue.service';
import { IncomesRepository } from './repositories/incomes.repository';
import { ReservesRepository } from './repositories/reserves.repository';
import { SpendsRepository } from './repositories/spends.repository';
import { HistoryProcessingService } from './services/history-processing.service';
import { HistoryService } from './services/history.service';

import { RedisModule } from 'infrastructure/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReserveEntity, IncomesEntity, SpendsEntity]),
    SourceModule,
    AssetModule,
    forwardRef(() => ContractModule),
    PriceModule,
    RedisModule,
  ],
  providers: [
    ReservesRepository,
    IncomesRepository,
    SpendsRepository,
    HistoryService,
    HistoryGetCommand,
    StatsGetCommand,
    HistoryProcessingService,
    HistoryCollectionQueueService,
  ],
  exports: [
    HistoryService,
    ReservesRepository,
    IncomesRepository,
    SpendsRepository,
    HistoryProcessingService,
    HistoryCollectionQueueService,
  ],
  controllers: [HistoryController],
})
export class HistoryModule {}
