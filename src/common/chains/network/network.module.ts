import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NetworkService } from './network.service';
import { ProviderFactory } from './provider.factory';

import networksConfig from 'config/networks.config';

@Module({
  imports: [ConfigModule.forFeature(networksConfig)],
  providers: [NetworkService, ProviderFactory],
  exports: [NetworkService, ProviderFactory],
})
export class NetworkModule {}
