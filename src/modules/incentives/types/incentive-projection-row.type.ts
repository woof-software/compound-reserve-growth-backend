export type IncentiveProjectionRow = {
  reserveId: number | null;
  spendId: number | null;
  sourceId: number;
  date: Date;
  incomes: number;
  rewardsSupply: number;
  rewardsBorrow: number;
  priceComp: number;
};
