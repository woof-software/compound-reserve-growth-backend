import { forwardRef, Module } from '@nestjs/common';

import { NetworkModule } from 'modules/network/network.module';
import { HistoryModule } from 'modules/history/history.module';
import { SourceModule } from 'modules/source/source.module';
import { PriceModule } from 'modules/price/price.module';
import { RedisModule } from 'modules/redis/redis.module';
import { MailModule } from 'modules/mail/mail.module';

import { AlgorithmService } from './algorithm.service';
import { ContractService } from './contract.service';

@Module({
  imports: [
    NetworkModule,
    // Circular dependency: ContractService -> HistoryService (this module needs HistoryModule),
    // and HistoryModule's GetHistoryService -> ContractService (history/cron/history-get.service.ts).
    // forwardRef is required; HistoryModule also uses forwardRef(() => ContractModule).
    forwardRef(() => HistoryModule),
    SourceModule,
    PriceModule,
    RedisModule,
    MailModule,
  ],
  providers: [ContractService, AlgorithmService],
  exports: [ContractService, AlgorithmService],
})
export class ContractModule {}
