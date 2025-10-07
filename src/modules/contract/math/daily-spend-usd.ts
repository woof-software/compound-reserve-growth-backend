import { ethers } from 'ethers';

import { YEAR_IN_SECONDS } from '@/common/constants';

/**
 * @param baseTrackingSpeed baseTrackingSupplySpeed or baseTrackingBorrowSpeed
 * @param trackingIndexDecimals scaleToDecimals(contract.trackingIndexScale)
 * @param compPriceUsd comp token price
 */
export const dailySpendUsd = (
  baseTrackingSpeed: bigint,
  trackingIndexDecimals: number,
  compPriceUsd: number,
): number => {
  const annualReward = ethers.formatUnits(
    baseTrackingSpeed * BigInt(YEAR_IN_SECONDS),
    trackingIndexDecimals,
  );
  return (Number(annualReward) / 365) * compPriceUsd;
};
