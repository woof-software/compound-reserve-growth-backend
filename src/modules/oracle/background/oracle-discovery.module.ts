import { Module } from '@nestjs/common';

import { SourceModule } from 'modules/source/source.module';
import { OracleModule } from 'modules/oracle/oracle.module';

import { BlockModule } from 'common/chains/block/block.module';
import { NetworkModule } from 'common/chains/network/network.module';

import { DiscoveryService } from './discovery.service';

@Module({
  imports: [OracleModule, NetworkModule, SourceModule, BlockModule],
  providers: [DiscoveryService],
})
export class OracleDiscoveryModule {}
