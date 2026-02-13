import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'modules/network/network.module';

import { Asset } from './asset.entity';
import { AssetRepository } from './asset.repository';
import { AssetService } from './asset.service';
import { AssetUpdateService } from './asset-update.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asset]), NetworkModule],
  providers: [AssetRepository, AssetService, AssetUpdateService],
  exports: [AssetService, AssetRepository, AssetUpdateService],
})
export class AssetModule {}
