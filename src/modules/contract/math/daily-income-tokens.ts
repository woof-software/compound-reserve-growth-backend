/**
 * @param tokens totalSupplyTokens or totalBorrowTokens
 * @param apr supplyApr or borrowApr
 * @returns tokens
 */
export const dailyIncomeTokens = (tokens: number, apr: number): number =>
  (tokens * apr) / 100 / 365;
