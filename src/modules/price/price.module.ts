import { Module } from '@nestjs/common';

import { RedisModule } from 'modules/redis/redis.module';

import { PriceService } from './price.service';

@Module({
  imports: [RedisModule],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
