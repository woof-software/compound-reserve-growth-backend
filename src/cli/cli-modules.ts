import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SourcesUpdateModule } from 'modules/sources-update/sources-update.module';
import { HistoryModule } from 'modules/history/history.module';
import { EventModule } from 'modules/event/event.module';
import { PriceModule } from 'modules/price/price.module';

import { DatabaseModule } from 'database/database.module';
import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import redis from 'config/redis';
import google from 'config/google';
import admin from 'config/admin';
import reserveSourcesConfig from 'config/reserve-sources.config';

const fullConfigLoad = [
  appConfig,
  databaseConfig,
  networksConfig,
  redis,
  google,
  admin,
  reserveSourcesConfig,
];

/** CLI root for sources:update — Config, Database, SourcesUpdateModule only. No Redis. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: fullConfigLoad,
    }),
    DatabaseModule,
    SourcesUpdateModule,
  ],
})
export class SourcesUpdateCliModule {}

/** CLI root for history:get and stats:get — requires REDIS_HOST (HistoryModule -> Contract, Price, Redis). */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: fullConfigLoad,
    }),
    DatabaseModule,
    HistoryModule,
  ],
})
export class HistoryCliModule {}

/** CLI root for event:fill — Config, Database, EventModule only. No Redis. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: fullConfigLoad,
    }),
    DatabaseModule,
    EventModule,
  ],
})
export class EventCliModule {}

/** CLI root for price:preload — requires REDIS_HOST (PriceModule -> Redis). */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: fullConfigLoad,
    }),
    DatabaseModule,
    PriceModule,
  ],
})
export class PriceCliModule {}
