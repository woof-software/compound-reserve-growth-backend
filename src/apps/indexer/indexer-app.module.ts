import { CacheModule } from '@nestjs/cache-manager';
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-ioredis-yet';
import Redis from 'ioredis';

import { CapoBackgroundModule } from 'modules/capo/capo-background.module';
import { HistoryCronModule } from 'modules/history/history-cron.module';
import { OracleDiscoveryModule } from 'modules/oracle/background/oracle-discovery.module';

import { REDIS_CLIENT, RedisModule } from 'infrastructure/redis/redis.module';
import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';
import blockTimingConfig from 'config/block-timing.config';
import { DatabaseModule } from 'database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, redis, blockTimingConfig],
    }),
    ScheduleModule.forRoot(),
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
    HistoryCronModule,
    OracleDiscoveryModule,
    CapoBackgroundModule,
  ],
})
export class IndexerAppModule {}
