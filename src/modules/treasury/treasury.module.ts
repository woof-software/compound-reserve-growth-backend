import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SourceModule } from 'modules/source/source.module';

import { Treasury } from './treasury.entity';
import { TreasuryRepository } from './treasury.repository';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [TypeOrmModule.forFeature([Treasury]), SourceModule],
  providers: [TreasuryRepository, TreasuryService],
  exports: [TreasuryService, TreasuryRepository],
})
export class TreasuryModule {}
