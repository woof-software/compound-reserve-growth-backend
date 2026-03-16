import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SourcesUpdateModule } from 'modules/sources-update/sources-update.module';

import { DatabaseModule } from 'database/database.module';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import reserveSourcesConfig from 'config/reserve-sources.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, networksConfig, reserveSourcesConfig],
    }),
    DatabaseModule,
    SourcesUpdateModule,
  ],
})
export class SourcesUpdateCliModule {}
