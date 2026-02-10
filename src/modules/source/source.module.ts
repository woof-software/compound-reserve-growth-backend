import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { NetworkModule } from 'modules/network/network.module';

import { Source } from './source.entity';
import { SourceRepository } from './source.repository';
import { SourceService } from './source.service';
import { SourceFillCommand } from './cli/source-fill.command';
import { SourceController } from './source.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Source]), AssetModule, NetworkModule],
  providers: [SourceRepository, SourceService, SourceFillCommand],
  exports: [SourceService, SourceRepository],
  controllers: [SourceController],
})
export class SourceModule {}
