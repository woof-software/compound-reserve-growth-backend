import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { ContractModule } from 'modules/contract/contract.module';
import { GithubModule } from 'modules/github/github.module';
import { JsonModule } from 'modules/json/json.module';
import { NetworkModule } from 'modules/network/network.module';
import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { HistoryModule } from 'modules/history/history.module';
import { TreasuryModule } from 'modules/treasury/treasury.module';
import { RevenueModule } from 'modules/revenue/revenue.module';

import { AppController } from './app.controller';

import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import { DatabaseModule } from 'database/database.module';
import { Logger } from 'infrastructure/logger';
import { ExceptionInterceptor } from 'infrastructure/http/interceptors/exception.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    DatabaseModule,
    GithubModule,
    NetworkModule,
    JsonModule,
    ContractModule,
    SourceModule,
    AssetModule,
    HistoryModule,
    TreasuryModule,
    RevenueModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ExceptionInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    Logger,
  ],
})
export class AppModule {}
