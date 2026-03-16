import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HistoryModule } from 'modules/history/history.module';

import { DatabaseModule } from 'database/database.module';
import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, redis],
    }),
    DatabaseModule,
    HistoryModule,
  ],
})
export class HistoryCliModule {}
