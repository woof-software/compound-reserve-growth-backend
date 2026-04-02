import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PriceModule } from '@/modules/price/price.module';
import { DatabaseModule } from 'database/database.module';
import databaseConfig from '@/config/database';
import networksConfig from '@/config/networks.config';
import redis from '@/config/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, networksConfig, redis],
    }),
    DatabaseModule,
    PriceModule,
  ],
})
export class PriceCliModule {}
