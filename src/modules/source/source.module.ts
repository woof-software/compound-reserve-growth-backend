import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Source } from './source.entity';
import { SourceRepository } from './source.repository';
import { SourceService } from './source.service';

@Module({
  imports: [TypeOrmModule.forFeature([Source])],
  providers: [SourceRepository, SourceService],
  exports: [SourceService, SourceRepository],
})
export class SourceModule {}
