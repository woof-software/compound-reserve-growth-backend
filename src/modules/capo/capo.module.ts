import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'modules/network/network.module';
import { SourceModule } from 'modules/source/source.module';
import { MailModule } from 'modules/mail/mail.module';
import { Source } from 'modules/source/source.entity';
import { OracleModule } from 'modules/oracle/oracle.module';
import { AlertModule } from 'modules/alert/alert.module';
import { Oracle } from 'modules/oracle/oracle.entity';

import { CapoController } from './capo.controller';
import { CapoService } from './capo.service';
import { Snapshot } from './snapshot.entity';
import { DailyAggregation } from './daily.entity';

@Module({
  imports: [
    NetworkModule,
    SourceModule,
    MailModule,
    OracleModule,
    AlertModule,
    TypeOrmModule.forFeature([Snapshot, DailyAggregation, Source]),
    TypeOrmModule.forFeature([Oracle]),
  ],
  controllers: [CapoController],
  providers: [CapoService],
  exports: [],
})
export class CapoModule {}
