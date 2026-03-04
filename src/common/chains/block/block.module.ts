import { Module } from '@nestjs/common';

import { NetworkModule } from 'common/chains/network/network.module';

import { BlockService } from './block.service';

import { RedisModule } from 'infrastructure/redis/redis.module';

@Module({
  imports: [NetworkModule, RedisModule],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
