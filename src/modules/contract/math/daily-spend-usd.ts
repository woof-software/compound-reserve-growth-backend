import { ethers } from 'ethers';

import { DAY_IN_SEC } from '@/common/constants';

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
  const dailyReward = ethers.formatUnits(
    baseTrackingSpeed * BigInt(DAY_IN_SEC),
    trackingIndexDecimals,
  );
  return Number(dailyReward) * compPriceUsd;
};
