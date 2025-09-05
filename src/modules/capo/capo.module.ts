import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'modules/network/network.module';
import { SourceModule } from 'modules/source/source.module';
import { MailModule } from 'modules/mail/mail.module';

import { OracleModule } from '../oracle/oracle.module';
import { AlertModule } from '../alert/alert.module';
import { CapoController } from './capo.controller';
import { CapoService } from './capo.service';
import { Oracle } from '../oracle/oracle.entity';
import { Snapshot } from './snapshot.entity';
import { DailyAggregation } from './daily.entity';
import { Source } from 'modules/source/source.entity';

@Module({
  imports: [
    NetworkModule,
    SourceModule,
    MailModule,
    OracleModule,
    AlertModule,
    TypeOrmModule.forFeature([Snapshot, DailyAggregation, Source]),
    TypeOrmModule.forFeature([Oracle])
  ],
  controllers: [CapoController],
  providers: [CapoService],
  exports: [],
})
export class CapoModule {}
