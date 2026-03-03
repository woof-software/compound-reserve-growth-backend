import { forwardRef, Module } from '@nestjs/common';

import { NetworkModule } from 'modules/network/network.module';
import { HistoryModule } from 'modules/history/history.module';
import { PriceModule } from 'modules/price/price.module';
import { MailModule } from 'modules/mail/mail.module';
import { BlockModule } from 'modules/block/block.module';

import { AlgorithmService } from './algorithm.service';
import { ContractService } from './contract.service';

@Module({
  imports: [
    NetworkModule,
    // Circular dependency: ContractService -> HistoryService (this module needs HistoryModule),
    // and HistoryModule's GetHistoryService -> ContractService (history/cron/history-get.service.ts).
    // forwardRef is required; HistoryModule also uses forwardRef(() => ContractModule).
    forwardRef(() => HistoryModule),
    PriceModule,
    MailModule,
    BlockModule,
  ],
  providers: [ContractService, AlgorithmService],
  exports: [ContractService, AlgorithmService],
})
export class ContractModule {}
