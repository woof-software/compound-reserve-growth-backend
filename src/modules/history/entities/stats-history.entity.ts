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
    supplyComp: number;
    borrowComp: number;
    priceComp: number;
  };
  sourceId: number;
  date: Date;
}
