import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Asset } from 'modules/asset/asset.entity';
import { Source } from 'modules/source/source.entity';
import { NetworkModule } from 'modules/network/network.module';

import { SyncRepository } from './repositories/sync.repository';
import { SourcesUpdateService } from './sources-update.service';
import { SourcesUpdateCommand } from './cli/sources-update.command';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Source]), NetworkModule],
  providers: [SyncRepository, SourcesUpdateService, SourcesUpdateCommand],
  exports: [SourcesUpdateService],
})
export class SourcesUpdateModule {}
