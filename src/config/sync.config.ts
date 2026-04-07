import { registerAs } from '@nestjs/config';

export const DEFAULT_SYNC_RESERVES_LIMIT = 100;
export const MAX_SYNC_RESERVES_LIMIT = 1000;
export const MAX_SYNC_RESERVES_CURSOR_LENGTH = 64;

export type SyncConfig = {
  reserves: {
    defaultLimit: number;
    maxLimit: number;
    maxCursorLength: number;
  };
};

export default registerAs('sync', (): SyncConfig => {
  return {
    reserves: {
      defaultLimit: DEFAULT_SYNC_RESERVES_LIMIT,
      maxLimit: MAX_SYNC_RESERVES_LIMIT,
      maxCursorLength: MAX_SYNC_RESERVES_CURSOR_LENGTH,
    },
  };
});
