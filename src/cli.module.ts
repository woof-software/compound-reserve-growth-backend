import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';

import { SourceModule } from 'modules/source/source.module';
import { SourcesUpdateModule } from 'modules/sources-update/sources-update.module';
import { HistoryModule } from 'modules/history/history.module';
import { PriceModule } from 'modules/price/price.module';
import { EventModule } from 'modules/event/event.module';

import { DatabaseModule } from 'database/database.module';
import appConfig from 'config/app';
import databaseConfig from 'config/database';
import networksConfig from 'config/networks.config';
import google from 'config/google';
import admin from 'config/admin';
import reserveSourcesConfig from '@/config/reserve-sources.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, networksConfig, google, admin, reserveSourcesConfig],
    }),
    CacheModule.register({ isGlobal: true }),
    MailerModule.forRoot({
      transport: {
        host: 'in-v3.mailjet.com',
        port: 587,
        auth: {
          user: process.env.MAILJET_USER,
          pass: process.env.MAILJET_PASS,
        },
      },
    }),
    DatabaseModule,
    SourceModule,
    SourcesUpdateModule,
    HistoryModule,
    PriceModule,
    EventModule,
  ],
})
export class CliModule {}
