import { DAY_IN_SEC, SEC_IN_MS } from '@/common/constants';

export function calculateTimeRangeFromFirstTargetTimestamp(
  firstTargetTs: number,
  lastTargetTs?: number,
): {
  firstMidnightUTC: number;
  todayMidnightUTC: number;
  dailyTs: number[];
} {
  const now = Math.floor(Date.now() / SEC_IN_MS);
  const currentDayMidnightUTC = Math.floor(now / DAY_IN_SEC) * DAY_IN_SEC;
  const todayMidnightUTC =
    typeof lastTargetTs === 'number'
      ? Math.min(currentDayMidnightUTC, lastTargetTs)
      : currentDayMidnightUTC;

  const dailyTs: number[] = [];
  for (let ts = firstTargetTs; ts <= todayMidnightUTC; ts += DAY_IN_SEC) {
    dailyTs.push(ts);
  }

  return {
    firstMidnightUTC: firstTargetTs,
    todayMidnightUTC,
    dailyTs,
  };
}

export function getUtcMidnightTimestamp(date: Date): number {
  return Math.floor(date.getTime() / SEC_IN_MS / DAY_IN_SEC) * DAY_IN_SEC;
}

export function getNextUtcMidnightTimestamp(timestamp: number): number {
  return Math.floor(timestamp / DAY_IN_SEC + 1) * DAY_IN_SEC;
}

export function getNextUtcMidnightTimestampFromDate(date: Date): number {
  return getUtcMidnightTimestamp(date) + DAY_IN_SEC;
}
