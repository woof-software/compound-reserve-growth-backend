import { Source } from 'modules/source/source.entity';

import { ResponseStatsAlgorithm } from './response-algorithm';

export interface PersistAccountingArgs {
  source: Source;
  blockTag: number;
  marketAccounting: ResponseStatsAlgorithm;
  price: number;
  reserveValue: number;
  incomeSupplyValue: number;
  incomeBorrowValue: number;
  spendSupplyValue: number;
  spendBorrowValue: number;
  date: Date;
}
