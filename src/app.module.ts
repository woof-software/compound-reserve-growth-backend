import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import Redis from 'ioredis';

import { ContractModule } from 'modules/contract/contract.module';
import { GithubModule } from 'modules/github/github.module';
import { NetworkModule } from 'modules/network/network.module';
import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { HistoryModule } from 'modules/history/history.module';
import { TreasuryModule } from 'modules/treasury/treasury.module';
import { RevenueModule } from 'modules/revenue/revenue.module';
import { PriceModule } from 'modules/price/price.module';
import { RedisModule, REDIS_CLIENT } from 'modules/redis/redis.module';

import { AppController } from './app.controller';

import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';
import { DatabaseModule } from 'database/database.module';
import { Logger } from 'infrastructure/logger';
import { ExceptionInterceptor } from 'infrastructure/http/interceptors/exception.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, redis],
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
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: async (config: ConfigService, redisClient: Redis) => ({
        store: await redisStore({
          redisInstance: redisClient,
          ttl: config.get<number>('redis.ttl'),
        }),
      }),
    }),
    DatabaseModule,
    GithubModule,
    NetworkModule,
    ContractModule,
    SourceModule,
    AssetModule,
    HistoryModule,
    TreasuryModule,
    RevenueModule,
    PriceModule,
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
