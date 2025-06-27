import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { Logger } from 'infrastructure/logger';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisClient');

        const client = new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: +config.get('REDIS_PORT', '6379'),
          password: config.get('REDIS_PASSWORD'),
          db: +config.get('REDIS_DB', '0'),
          tls: config.get('REDIS_TLS', 'false') === 'true' ? {} : undefined,
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
