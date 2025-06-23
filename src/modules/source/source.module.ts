import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContractModule } from 'modules/contract/contract.module';
import { GithubModule } from 'modules/github/github.module';
import { AssetModule } from 'modules/asset/asset.module';

import { Source } from './source.entity';
import { SourceRepository } from './source.repository';
import { SourceService } from './source.service';
import { SourceFillCommand } from './cli/source-fill.command';

@Module({
  imports: [TypeOrmModule.forFeature([Source]), GithubModule, ContractModule, AssetModule],
  providers: [SourceRepository, SourceService, SourceFillCommand],
  exports: [SourceService, SourceRepository],
})
export class SourceModule {}
