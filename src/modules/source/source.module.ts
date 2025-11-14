import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GithubModule } from 'modules/github/github.module';
import { AssetModule } from 'modules/asset/asset.module';
import { ContractModule } from 'modules/contract/contract.module';

import { Source } from './source.entity';
import { SourceRepository } from './source.repository';
import { SourceService } from './source.service';
import { SourceFillCommand } from './cli/source-fill.command';
import { SourceController } from './source.controller';

import { ApiKeyGuardModule } from '@/common/guards/api-key';

@Module({
  imports: [
    TypeOrmModule.forFeature([Source]),
    GithubModule,
    AssetModule,
    forwardRef(() => ContractModule),
    ApiKeyGuardModule,
  ],
  providers: [SourceRepository, SourceService, SourceFillCommand],
  exports: [SourceService, SourceRepository],
  controllers: [SourceController],
})
export class SourceModule {}
