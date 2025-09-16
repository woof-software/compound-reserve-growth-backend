import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from 'modules/mail/mail.module';

import { Alert } from './alert.entity';
import { AlertService } from './alert.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [TypeOrmModule.forFeature([Alert]), MailModule],
  providers: [AlertService, TelegramService],
  exports: [AlertService],
})
export class AlertModule {}
