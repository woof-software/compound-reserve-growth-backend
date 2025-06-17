import { Module } from '@nestjs/common';

import { ContractService } from './contract.service';

import { NetworkModule } from 'network/network.module';
import { JsonModule } from 'json/json.module';

@Module({
  imports: [NetworkModule, JsonModule],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
