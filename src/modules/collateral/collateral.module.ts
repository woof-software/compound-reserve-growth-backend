import { Module } from '@nestjs/common';

import { CollateralAlgorithmService } from './collateral-algorithm.service';
import { CollateralService } from './collateral.service';
import { CollateralSearchMarketsV3Command } from './cli/collateral-search-markets-v3.command';

import { ContractModule } from '@/modules/contract/contract.module';
import { SourceModule } from '@/modules/source/source.module';
import { BlockModule } from '@/common/chains/block/block.module';
import { NetworkModule } from '@/common/chains/network/network.module';

@Module({
  imports: [SourceModule, NetworkModule, BlockModule, ContractModule],
  providers: [CollateralAlgorithmService, CollateralService, CollateralSearchMarketsV3Command],
  exports: [CollateralService],
})
export class CollateralModule {}
