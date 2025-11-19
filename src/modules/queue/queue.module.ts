import * as process from 'node:process';

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const environment =
          config.get<string>('database.environment') ?? process.env.NODE_ENV ?? 'local';

        return {
          connection: {
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            password: config.get<string>('redis.password'),
            db: config.get<number>('redis.db'),
            tls: config.get('redis.tls'),
          },
          defaultJobOptions: {
            attempts: 3,
            removeOnComplete: 1000,
            removeOnFail: 1000,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
          prefix: `reserve:${environment}`,
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
