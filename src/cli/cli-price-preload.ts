import { LogLevel, Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import { PriceCliModule } from './cli-modules';

async function bootstrap() {
  const logLevel = ['log', 'error', 'warn', 'debug', 'verbose'] as LogLevel[];
  await CommandFactory.run(PriceCliModule, { logger: logLevel });
  process.exit(0);
}

bootstrap().catch((err) => {
  Logger.error('Error starting CLI:', err);
  process.exit(1);
});
