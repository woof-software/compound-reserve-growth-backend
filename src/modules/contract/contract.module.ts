import { Module } from '@nestjs/common';

import { NetworkModule } from 'modules/network/network.module';
import { HistoryModule } from 'modules/history/history.module';
import { SourceModule } from 'modules/source/source.module';
import { PriceModule } from 'modules/price/price.module';
import { RedisModule } from 'modules/redis/redis.module';

import { ContractService } from './contract.service';

@Module({
  imports: [NetworkModule, HistoryModule, SourceModule, PriceModule, RedisModule],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
