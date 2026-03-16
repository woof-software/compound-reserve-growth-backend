import { LogLevel, Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import { CollateralCliModule } from './collateral-cli.module';

async function bootstrap() {
  const logLevel = ['log', 'error', 'warn', 'debug', 'verbose'] as LogLevel[];
  await CommandFactory.run(CollateralCliModule, { logger: logLevel });
  process.exit(0);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  Logger.error(`Error starting CLI: ${message}`);
  process.exit(1);
});
