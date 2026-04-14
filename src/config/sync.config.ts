import { registerAs } from '@nestjs/config';

export const DEFAULT_SYNC_RESERVES_LIMIT = 100;
export const MAX_SYNC_RESERVES_LIMIT = 1000;
export const MAX_SYNC_RESERVES_CURSOR_LENGTH = 64;

const integrationKitHash = process.env.INTEGRATION_KIT_HASH;

export type SyncConfig = {
  accessKeyHash: string;
  reserves: {
    defaultLimit: number;
    maxLimit: number;
    maxCursorLength: number;
  };
};

export default registerAs('sync', (): SyncConfig => {
  return {
    accessKeyHash: integrationKitHash ?? '',
    reserves: {
      defaultLimit: DEFAULT_SYNC_RESERVES_LIMIT,
      maxLimit: MAX_SYNC_RESERVES_LIMIT,
      maxCursorLength: MAX_SYNC_RESERVES_CURSOR_LENGTH,
    },
  };
});
