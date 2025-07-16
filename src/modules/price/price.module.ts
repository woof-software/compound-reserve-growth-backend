import { Module } from '@nestjs/common';

import { RedisModule } from 'modules/redis/redis.module';

import { PriceService } from './price.service';
import { CoinGeckoModule } from './providers/coingecko/coingecko.module';

@Module({
  imports: [RedisModule, CoinGeckoModule],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
