import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
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
import { RunwayModule } from 'modules/runway/runway.module';
import { MailModule } from 'modules/mail/mail.module';
import { EventModule } from 'modules/event/event.module';
import { CoinGeckoModule } from 'modules/price/providers/coingecko/coingecko.module';

import { AppController } from './app.controller';

import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';
import google from 'config/google';
import { DatabaseModule } from 'database/database.module';
import { Logger } from 'infrastructure/logger';
import { ExceptionInterceptor } from 'infrastructure/http/interceptors/exception.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, redis, google],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 1000,
          limit: 10,
        },
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: async (cfg: ConfigService, client: Redis) => ({
        store: redisStore,
        redisInstance: client,
        ttl: cfg.get<number>('redis.ttl'),
      }),
    }),
    MailerModule.forRoot({
      transport: {
        host: 'in-v3.mailjet.com',
        port: 587,
        auth: {
          user: process.env.MAILJET_USER,
          pass: process.env.MAILJET_PASS,
        },
      },
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
    CoinGeckoModule,
    PriceModule,
    RunwayModule,
    MailModule,
    EventModule,
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
