import { Module } from '@nestjs/common';

import { ContractModule } from 'modules/contract/contract.module';
import { NetworkModule } from 'modules/network/network.module';
import { SourceModule } from 'modules/source/source.module';

import { CollateralService } from './collateral.service';
import { CollateralSearchMarketsV3Command } from './cli/collateral-search-markets-v3.command';

@Module({
  imports: [SourceModule, NetworkModule, ContractModule],
  providers: [CollateralService, CollateralSearchMarketsV3Command],
  exports: [CollateralService],
})
export class CollateralModule {}
