import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SyncRepository } from './repositories/sync.repository';
import { SourcesUpdateService } from './sources-update.service';
import { SourcesUpdateCommand } from './cli/sources-update.command';
import { SourcesUpdateValidationService } from './sources-validator';

import { NetworkModule } from '@/common/chains/network/network.module';
import { SourceEntity } from '@/modules/source/source.entity';
import { AssetEntity } from '@/modules/asset/asset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssetEntity, SourceEntity]), NetworkModule],
  providers: [
    SyncRepository,
    SourcesUpdateService,
    SourcesUpdateValidationService,
    SourcesUpdateCommand,
  ],
  exports: [SourcesUpdateService],
})
export class SourcesUpdateModule {}
