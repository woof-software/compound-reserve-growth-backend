import { Module } from '@nestjs/common';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';
import { DataUpdateService } from 'modules/data-update/data-update.service';

import { DataUpdateCommand } from './cli/data-update.command';

@Module({
  imports: [AssetModule, SourceModule],
  providers: [DataUpdateService, DataUpdateCommand],
  exports: [DataUpdateService],
})
export class DataUpdateModule {}
