import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'modules/network/network.module';
import { SourceModule } from 'modules/source/source.module';
import { MailModule } from 'modules/mail/mail.module';

import { OracleService } from './oracle.service';
import { CapoController } from './capo.controller';
import { CapoService } from './capo.service';
import { DiscoveryService } from './discovery.service';
import { Oracle } from './entities/oracle.entity';
import { Snapshot } from './entities/snapshot.entity';
import { DailyAggregation } from './entities/daily.entity';
import { AlertService } from './alert.service';
import { Alert } from './entities/alert.entity';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    NetworkModule,
    SourceModule,
    MailModule,
    TypeOrmModule.forFeature([Oracle, Snapshot, DailyAggregation, Alert]),
  ],
  controllers: [CapoController],
  providers: [
    CapoService,
    DiscoveryService,
    OracleService,
    AlertService,
    TelegramService,
  ],
  exports: [DiscoveryService],
})
export class CapoModule {}
