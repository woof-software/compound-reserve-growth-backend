import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { ContractModule } from 'modules/contract/contract.module';
import { PriceModule } from 'modules/price/price.module';
import { RedisModule } from 'modules/redis/redis.module';
import { Price } from 'modules/price/price.entity';

import { Reserve, Incomes, Spends } from './entities';
import { ReservesRepository } from './reserves-repository.service';
import { HistoryService } from './history.service';
import { HistoryGetCommand } from './cli/history-get.command';
import { StatsGetCommand } from './cli/stats-get.command';
import { HistoryController } from './history.controller';
import { HistoryGetCron } from './cron/history-get.cron';
import { GetHistoryService } from './cron/history-get.service';
import { IncomesRepository } from './incomes-repository.service';
import { SpendsRepository } from './spends-repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserve, Incomes, Spends, Price]),
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
    HistoryGetCron,
    GetHistoryService,
  ],
  exports: [
    HistoryService,
    ReservesRepository,
    IncomesRepository,
    SpendsRepository,
    GetHistoryService,
  ],
  controllers: [HistoryController],
})
export class HistoryModule {}
