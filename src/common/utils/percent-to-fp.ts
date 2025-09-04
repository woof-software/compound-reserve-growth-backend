import { PERCENT_PRECISION_SCALE } from '@app/common/constants';

export const percentToFp = (percent: number): bigint =>
  BigInt(Math.round(percent * PERCENT_PRECISION_SCALE));
