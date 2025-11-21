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
        const environment = config.get<string>('database.environment') ?? 'local';

        return {
          connection: {
            host: config.getOrThrow<string>('redis.host'),
            port: config.getOrThrow<number>('redis.port'),
            password: config.get<string>('redis.password'),
            db: config.getOrThrow<number>('redis.db'),
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
