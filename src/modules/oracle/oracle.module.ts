import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'modules/network/network.module';
import { SourceModule } from 'modules/source/source.module';

import { Oracle } from './oracle.entity';
import { OracleService } from './oracle.service';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [TypeOrmModule.forFeature([Oracle]), NetworkModule, SourceModule],
  providers: [OracleService, DiscoveryService],
  exports: [OracleService, DiscoveryService],
})
export class OracleModule {}
