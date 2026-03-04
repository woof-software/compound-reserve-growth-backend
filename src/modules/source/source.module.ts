import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';

import { NetworkModule } from 'common/chains/network/network.module';

import { SourceEntity } from './source.entity';
import { SourceRepository } from './source.repository';
import { SourceService } from './source.service';
import { SourceController } from './source.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SourceEntity]), AssetModule, NetworkModule],
  providers: [SourceRepository, SourceService],
  exports: [SourceService, SourceRepository],
  controllers: [SourceController],
})
export class SourceModule {}
