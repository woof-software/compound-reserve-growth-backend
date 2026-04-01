import { CacheModule } from '@nestjs/cache-manager';
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import Redis from 'ioredis';

import { CollateralModule } from '@/modules/collateral/collateral.module';
import { REDIS_CLIENT, RedisModule } from 'infrastructure/redis/redis.module';
import appConfig from '@/config/app';
import blockTimingConfig from '@/config/block-timing.config';
import contractConfig from '@/config/contract';
import databaseConfig from '@/config/database';
import networksConfig from '@/config/networks.config';
import priceOnChainConfig from '@/config/price-on-chain.config';
import redis from '@/config/redis';
import { DatabaseModule } from 'database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        networksConfig,
        redis,
        contractConfig,
        priceOnChainConfig,
        blockTimingConfig,
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
    CollateralModule,
  ],
})
export class CollateralCliModule {}
