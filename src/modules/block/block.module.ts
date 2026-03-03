import { Module } from '@nestjs/common';

import { NetworkModule } from 'modules/network/network.module';
import { RedisModule } from 'modules/redis/redis.module';

import { BlockService } from './block.service';

@Module({
  imports: [NetworkModule, RedisModule],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
