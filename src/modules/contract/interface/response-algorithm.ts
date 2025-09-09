export interface ResponseAlgorithm {
  reserves: number;
  incomes: {
    supply: number;
    borrow: number;
  };
  spends: {
    supplyUsd: number;
    borrowUsd: number;
  };
}
