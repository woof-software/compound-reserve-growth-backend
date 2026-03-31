import { Algorithm } from '@/common/enum/algorithm.enum';

export const REVENUE_SUPPORTED_ALGORITHMS = new Set<Algorithm>([
  Algorithm.COMET,
  Algorithm.MARKET_V2,
  Algorithm.AERA_COMPOUND_RESERVES,
]);
