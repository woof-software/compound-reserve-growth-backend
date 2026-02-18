import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetEntity } from 'modules/asset/asset.entity';
import { SourceEntity } from 'modules/source/source.entity';
import { NetworkModule } from 'modules/network/network.module';
import { ReserveEntity, IncomesEntity, SpendsEntity } from 'modules/history/entities';
import { TreasuryEntity } from 'modules/treasury/treasury.entity';
import { RevenueEntity } from 'modules/revenue/revenue.entity';

import { SyncRepository } from './repositories/sync.repository';
import { SourcesUpdateService } from './sources-update.service';
import { SourcesUpdateCommand } from './cli/sources-update.command';
import { SourcesUpdateValidationService } from './sources-validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetEntity,
      SourceEntity,
      ReserveEntity,
      IncomesEntity,
      SpendsEntity,
      TreasuryEntity,
      RevenueEntity,
    ]),
    NetworkModule,
  ],
  providers: [
    SyncRepository,
    SourcesUpdateService,
    SourcesUpdateValidationService,
    SourcesUpdateCommand,
  ],
  exports: [SourcesUpdateService],
})
export class SourcesUpdateModule {}
