import { ConnectionOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export const createHistoryCollectionConnection = (
  configService: ConfigService,
): ConnectionOptions => ({
  host: configService.getOrThrow<string>('redis.host'),
  port: configService.getOrThrow<number>('redis.port'),
  password: configService.get<string>('redis.password'),
  db: configService.get<number>('redis.db'),
  tls: configService.get('redis.tls'),
  maxRetriesPerRequest: null,
});
