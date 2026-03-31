import { Algorithm } from '@/common/enum/algorithm.enum';

export const INCENTIVES_SUPPORTED_ALGORITHMS = new Set<Algorithm>([
  Algorithm.COMET_STATS,
  Algorithm.MARKET_V2,
  Algorithm.AERA_COMPOUND_RESERVES,
]);
