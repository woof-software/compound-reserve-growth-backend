import { LogLevel, Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module';

async function bootstrap() {
  const logLevel = ['log', 'error', 'warn', 'debug', 'verbose'] as LogLevel[];
  await CommandFactory.run(AppModule, { logger: logLevel });
  process.exit(0);
}

bootstrap().catch((err) => {
  Logger.error('Error starting CLI:', err);
  process.exit(1);
});
