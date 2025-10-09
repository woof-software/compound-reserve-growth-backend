export interface StatsHistory {
  incomes: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
  };
  spends?: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
  };
  sourceId: number;
  priceComp: number;
  date: Date;
}
