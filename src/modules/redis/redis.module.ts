import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { getRedisNoop } from './redis-noop';

import { Logger } from 'infrastructure/logger';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisClient');

        const redisHost = config.get<string>('redis.host');
        if (!redisHost) {
          logger.log('REDIS_HOST not set, using no-op Redis (cache disabled)');
          return getRedisNoop() as unknown as Redis;
        }

        logger.log(`Connecting to Redis at ${redisHost}`);
        const client = new Redis({
          lazyConnect: true,
          host: redisHost,
          port: config.get('redis.port'),
          password: config.get('redis.password'),
          db: config.get('redis.db'),
          tls: config.get('redis.tls'),
          connectTimeout: config.get('redis.timeout'),
          retryStrategy: (times) => Math.min(times * 50, 2000),
          reconnectOnError: (err) => err.message.includes('READONLY'),
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('ready', () => logger.log('Redis ready'));
        client.on('error', (e) => logger.error(`Redis error: ${e.message}`));
        client.on('reconnecting', (d) => logger.warn(`Redis reconnect in ${d} ms`));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
