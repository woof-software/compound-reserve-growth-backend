import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SourceModule } from 'modules/source/source.module';
import { HistoryModule } from 'modules/history/history.module';

import { Treasury } from './treasury.entity';
import { TreasuryRepository } from './treasury.repository';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Treasury]), SourceModule, HistoryModule],
  providers: [TreasuryRepository, TreasuryService],
  exports: [TreasuryService, TreasuryRepository],
  controllers: [TreasuryController],
})
export class TreasuryModule {}
