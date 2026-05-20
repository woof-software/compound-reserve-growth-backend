import { registerAs } from '@nestjs/config';

export const DEFAULT_SYNC_RESERVES_LIMIT = 100;
export const MAX_SYNC_RESERVES_LIMIT = 1000;
export const MAX_SYNC_RESERVES_CURSOR_LENGTH = 64;
export const EXCLUDED_SYNC_RESERVES_NETWORKS = ['ronin', 'scroll'];

const integrationKitHash = process.env.INTEGRATION_KIT_HASH;
if (!integrationKitHash) {
  throw new Error('Missing env INTEGRATION_KIT_HASH');
}

export type SyncConfig = {
  accessKeyHash: string;
  reserves: {
    defaultLimit: number;
    maxLimit: number;
    maxCursorLength: number;
    excludedNetworks: string[];
  };
};

export default registerAs('sync', (): SyncConfig => {
  return {
    accessKeyHash: integrationKitHash,
    reserves: {
      defaultLimit: DEFAULT_SYNC_RESERVES_LIMIT,
      maxLimit: MAX_SYNC_RESERVES_LIMIT,
      maxCursorLength: MAX_SYNC_RESERVES_CURSOR_LENGTH,
      excludedNetworks: EXCLUDED_SYNC_RESERVES_NETWORKS,
    },
  };
});
