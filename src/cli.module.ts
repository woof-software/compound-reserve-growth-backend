import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { redisStore } from 'cache-manager-ioredis-yet';
import Redis from 'ioredis';

import { DatabaseModule } from 'database/database.module';
import { RedisModule, REDIS_CLIENT } from 'modules/redis/redis.module';
import { SourceModule } from 'modules/source/source.module';
import { HistoryModule } from 'modules/history/history.module';
import { PriceModule } from 'modules/price/price.module';
import { EventModule } from 'modules/event/event.module';
import { CollateralModule } from 'modules/collateral/collateral.module';

import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';
import google from 'config/google';
import admin from 'config/admin';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, redis, google, admin],
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
    SourceModule,
    HistoryModule,
    PriceModule,
    EventModule,
    CollateralModule,
  ],
})
export class CliModule {}
