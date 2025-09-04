export interface ResponseAlgorithm {
  reserves: bigint;
  incomes: {
    supply: bigint;
    borrow: bigint;
  };
  spends: {
    supply: bigint;
    borrow: bigint;
  };
}
