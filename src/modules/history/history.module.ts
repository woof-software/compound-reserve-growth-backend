import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { ContractModule } from 'modules/contract/contract.module';
import { RedisModule } from 'modules/redis/redis.module';
import { LiquidationEventService } from 'modules/history/liquidation-event.service';

import { Reserve, Incomes, Spends, LiquidationEvent } from './entities';
import { ReservesRepository } from './reserves-repository.service';
import { HistoryService } from './history.service';
import { HistoryGetCommand } from './cli/history-get.command';
import { HistoryController } from './history.controller';
import { HistoryGetCron } from './cron/history-get.cron';
import { GetHistoryService } from './cron/history-get.service';
import { IncomesRepository } from './incomes-repository.service';
import { SpendsRepository } from './spends-repository.service';
import { LiquidationEventRepositoryService } from './liquidation-event-repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserve, Incomes, Spends, LiquidationEvent]),
    SourceModule,
    AssetModule,
    forwardRef(() => ContractModule),
    RedisModule,
  ],
  providers: [
    ReservesRepository,
    IncomesRepository,
    SpendsRepository,
    LiquidationEventRepositoryService,
    HistoryService,
    LiquidationEventService,
    HistoryGetCommand,
    HistoryGetCron,
    GetHistoryService,
  ],
  exports: [
    HistoryService,
    LiquidationEventService,
    ReservesRepository,
    IncomesRepository,
    SpendsRepository,
    LiquidationEventRepositoryService,
  ],
  controllers: [HistoryController],
})
export class HistoryModule {}
