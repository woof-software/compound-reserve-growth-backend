import { Module } from '@nestjs/common';

import { BlockService } from './block.service';

import { NetworkModule } from '@/common/chains/network/network.module';
import { RedisModule } from 'infrastructure/redis/redis.module';

@Module({
  imports: [NetworkModule, RedisModule],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
