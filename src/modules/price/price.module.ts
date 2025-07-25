import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from 'modules/redis/redis.module';

import { PriceService } from './price.service';
import { CoinGeckoModule } from './providers/coingecko/coingecko.module';
import { Price } from './price.entity';
import { PriceRepository } from './price.repository';
import { PricePreloadCommand } from './cli/price-preload.command';

@Module({
  imports: [TypeOrmModule.forFeature([Price]), RedisModule, CoinGeckoModule],
  providers: [PriceService, PriceRepository, PricePreloadCommand],
  exports: [PriceService, PriceRepository],
})
export class PriceModule {}
