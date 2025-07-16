import { Module } from '@nestjs/common';

import { CoinGeckoProviderService } from './coingecko.service';

@Module({
  providers: [CoinGeckoProviderService],
  exports: [CoinGeckoProviderService],
})
export class CoinGeckoModule {}
