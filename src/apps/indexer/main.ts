import 'dotenv/config';
import { LogLevel, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { IndexerAppModule } from './indexer-app.module';

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL?.split(',') || ['error']) as LogLevel[];
  const logger = new Logger('IndexerBootstrap');

  const app = await NestFactory.createApplicationContext(IndexerAppModule, {
    logger: logLevel,
  });
  logger.log('History indexer process is running');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Shutting down history indexer process...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('IndexerBootstrap');
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Failed to bootstrap history indexer process: ${message}`);
  process.exit(1);
});
