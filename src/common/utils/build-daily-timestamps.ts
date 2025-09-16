import { DAY_IN_SEC } from 'common/constants';

export function buildDailyTimestamps(startTs: number, endTs: number): number[] {
  const dailyTs: number[] = [];
  for (let ts = startTs; ts <= endTs; ts += DAY_IN_SEC) {
    dailyTs.push(ts);
  }
  return dailyTs;
}
