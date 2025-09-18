export interface StatsHistory {
  incomes: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
    date: Date;
  };
  spends?: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
    date: Date;
  };
  sourceId: number;
}
