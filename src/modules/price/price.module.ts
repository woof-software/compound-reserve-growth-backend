import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CollateralPriceService } from './collateral-price.service';
import { FeedPriceService } from './feed-price.service';
import { PriceService } from './price.service';
import { CoinGeckoModule } from './providers/coingecko/coingecko.module';
import { Price } from './price.entity';
import { PriceRepository } from './price.repository';
import { PricePreloadCommand } from './cli/price-preload.command';
import { QuotePriceService } from './quote-price.service';

import { RedisModule } from 'infrastructure/redis/redis.module';
import { BlockModule } from '@/common/chains/block/block.module';
import priceOnChainConfig from '@/config/price-on-chain.config';
import { NetworkModule } from '@/common/chains/network/network.module';

@Module({
  imports: [
    ConfigModule.forFeature(priceOnChainConfig),
    TypeOrmModule.forFeature([Price]),
    RedisModule,
    CoinGeckoModule,
    NetworkModule,
    BlockModule,
  ],
  providers: [
    CollateralPriceService,
    FeedPriceService,
    PriceService,
    PriceRepository,
    PricePreloadCommand,
    QuotePriceService,
  ],
  exports: [PriceService, PriceRepository],
})
export class PriceModule {}
