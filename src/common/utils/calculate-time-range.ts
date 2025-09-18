import { DAY_IN_SEC, SEC_IN_MS } from '@/common/constants';

export function calculateTimeRange(startTs: number): {
  firstMidnightUTC: number;
  todayMidnightUTC: number;
  dailyTs: number[];
} {
  const firstMidnightUTC = Math.floor(startTs / DAY_IN_SEC + 1) * DAY_IN_SEC;
  const now = Math.floor(Date.now() / SEC_IN_MS);
  const todayMidnightUTC = Math.floor(now / DAY_IN_SEC) * DAY_IN_SEC;

  const dailyTs: number[] = [];
  for (let ts = firstMidnightUTC; ts <= todayMidnightUTC; ts += DAY_IN_SEC) {
    dailyTs.push(ts);
  }

  return {
    firstMidnightUTC,
    todayMidnightUTC,
    dailyTs,
  };
}
