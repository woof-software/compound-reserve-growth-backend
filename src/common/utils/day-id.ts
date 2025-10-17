import { DAY_IN_MS } from '@/common/constants';

export const dayId = (date: Date): number => Math.floor(date.getTime() / DAY_IN_MS);
