import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetEntity } from './asset.entity';
import { AssetRepository } from './asset.repository';
import { AssetService } from './asset.service';

@Module({
  imports: [TypeOrmModule.forFeature([AssetEntity])],
  providers: [AssetRepository, AssetService],
  exports: [AssetService, AssetRepository],
})
export class AssetModule {}
