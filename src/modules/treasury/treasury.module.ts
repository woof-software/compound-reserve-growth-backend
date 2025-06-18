import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetModule } from 'modules/asset/asset.module';
import { SourceModule } from 'modules/source/source.module';

import { Treasury } from './treasury.entity';
import { TreasuryRepository } from './treasury.repository';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [TypeOrmModule.forFeature([Treasury]), SourceModule, AssetModule],
  providers: [TreasuryRepository, TreasuryService],
  exports: [TreasuryService, TreasuryRepository],
})
export class TreasuryModule {}
