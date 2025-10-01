export interface ResponseStatsAlgorithm {
  incomes: {
    supply: number;
    borrow: number;
  };
  spends?: {
    supplyComp: number;
    supplyUsd: number;
    borrowComp: number;
    borrowUsd: number;
  };
}
