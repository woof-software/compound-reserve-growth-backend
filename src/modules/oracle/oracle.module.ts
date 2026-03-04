import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SourceModule } from 'modules/source/source.module';

import { NetworkModule } from 'common/chains/network/network.module';
import { BlockModule } from 'common/chains/block/block.module';

import { Oracle } from './oracle.entity';
import { OracleService } from './oracle.service';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [TypeOrmModule.forFeature([Oracle]), NetworkModule, SourceModule, BlockModule],
  providers: [OracleService, DiscoveryService],
  exports: [OracleService, DiscoveryService],
})
export class OracleModule {}
