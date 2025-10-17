import { dayId } from './day-id';

export const generateDailyKey = (sourceId: number, date: Date): string =>
  `${sourceId}_${dayId(date)}`;
