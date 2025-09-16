import { DAY_IN_SEC, SEC_IN_MS } from 'common/constants';

export function dayBounds(startTs: number): { firstMidnightUTC: number; todayMidnightUTC: number } {
  const firstMidnightUTC = Math.floor(startTs / DAY_IN_SEC + 1) * DAY_IN_SEC;
  const now = Math.floor(Date.now() / SEC_IN_MS);
  const todayMidnightUTC = Math.floor(now / DAY_IN_SEC) * DAY_IN_SEC;
  return { firstMidnightUTC, todayMidnightUTC };
}
