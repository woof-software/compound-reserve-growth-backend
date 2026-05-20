import { forwardRef, Module } from '@nestjs/common';

import { AlgorithmService } from './algorithm.service';
import { ContractService } from './contract.service';

import { HistoryModule } from '@/modules/history/history.module';
import { PriceModule } from '@/modules/price/price.module';
import { MailModule } from '@/modules/mail/mail.module';
import { NetworkModule } from '@/common/chains/network/network.module';
import { BlockModule } from '@/common/chains/block/block.module';

@Module({
  imports: [
    NetworkModule,
    // Circular dependency: ContractService -> HistoryService (this module needs HistoryModule),
    // and HistoryModule's HistoryProcessingService -> ContractService.
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
