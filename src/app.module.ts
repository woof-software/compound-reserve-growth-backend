import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { ContractModule } from 'modules/contract/contract.module';
import { GithubModule } from 'modules/github/github.module';
import { NetworkModule } from 'modules/network/network.module';
import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { HistoryModule } from 'modules/history/history.module';
import { TreasuryModule } from 'modules/treasury/treasury.module';
import { RevenueModule } from 'modules/revenue/revenue.module';
import { PriceModule } from 'modules/price/price.module';

import { AppController } from './app.controller';
import { getErrorMessage } from './common/utils/get-error-message';

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
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisCache');

        try {
          // Get Redis configuration from environment
          const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
          const redisPort = parseInt(configService.get<string>('REDIS_PORT', '6379'), 10);
          const redisPassword = configService.get<string>('REDIS_PASSWORD');
          const redisDb = parseInt(configService.get<string>('REDIS_DB', '0'), 10);
          const redisTls = configService.get<string>('REDIS_TLS', 'false') === 'true';
          const redisDefaultTtl = parseInt(
            configService.get<string>('REDIS_DEFAULT_TTL', '86400'),
            10,
          );
          const redisConnectionTimeout = parseInt(
            configService.get<string>('REDIS_CONNECTION_TIMEOUT', '10000'),
            10,
          );

          logger.log(`Connecting to Redis at ${redisHost}:${redisPort} (DB: ${redisDb})`);

          // Create Redis store with configuration
          const store = await redisStore({
            ttl: redisDefaultTtl,
            socket: {
              host: redisHost,
              port: redisPort,
              connectTimeout: redisConnectionTimeout,
              tls: redisTls, // Enable TLS if required
            },
            password: redisPassword,
            database: redisDb,
          });

          // Set up error handling
          store.client.on('error', (err) => {
            const aggregateErrors =
              err instanceof AggregateError ? err.errors.map(getErrorMessage) : [];
            const reason = getErrorMessage(err);
            logger.error(`Redis client error: ${JSON.stringify({ reason, aggregateErrors })}`);
          });

          store.client.on('connect', () => {
            logger.log('Redis client connected successfully');
          });

          store.client.on('ready', () => {
            logger.log('Redis client ready to accept commands');
          });

          store.client.on('end', () => {
            logger.warn('Redis client connection ended');
          });

          store.client.on('reconnecting', () => {
            logger.log('Redis client reconnecting...');
          });

          // Test connection
          try {
            await store.client.ping();
            logger.log('Redis ping successful - cache store setup completed');
          } catch (pingError) {
            logger.warn(
              `Redis ping failed: ${getErrorMessage(pingError)}, but continuing with setup`,
            );
          }

          return {
            store,
            isGlobal: true,
          };
        } catch (err) {
          const aggregateErrors =
            err instanceof AggregateError ? err.errors.map(getErrorMessage) : [];
          const reason = getErrorMessage(err);
          logger.error(
            `Failed to setup Redis cache store: ${JSON.stringify({ reason, aggregateErrors })}`,
          );

          throw new Error(`Redis cache setup failed: ${reason}`);
        }
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
