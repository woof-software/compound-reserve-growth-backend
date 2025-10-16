export interface ResponseStatsAlgorithm {
  incomes: {
    supply: number;
    borrow: number;
  };
  spends?: {
    supplyUsd: number;
    borrowUsd: number;
  };
}
