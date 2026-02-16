import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EventModule } from 'modules/event/event.module';

import { DatabaseModule } from 'database/database.module';
import databaseConfig from 'config/database';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    EventModule,
  ],
})
export class EventCliModule {}
