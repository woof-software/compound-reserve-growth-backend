import { registerAs } from '@nestjs/config';

import type { BlockTimingConfigData } from 'modules/block/block.types';

export default registerAs(
  'blockTiming',
  (): BlockTimingConfigData => ({
    networks: {
      mainnet: { mode: 'fixed', avgBlockTime: 12, blocksPerDay: 7200 },
      sepolia: { mode: 'fixed', avgBlockTime: 12.37, blocksPerDay: 6985 },
      ronin: { mode: 'fixed', avgBlockTime: 3, blocksPerDay: 28800 },
      polygon: { mode: 'fixed', avgBlockTime: 2, blocksPerDay: 43200 },
      optimism: { mode: 'fixed', avgBlockTime: 2, blocksPerDay: 43200 },
      mantle: { mode: 'fixed', avgBlockTime: 2, blocksPerDay: 43200 },
      unichain: { mode: 'fixed', avgBlockTime: 1, blocksPerDay: 86400 },
      base: { mode: 'fixed', avgBlockTime: 2, blocksPerDay: 43200 },
      avalanche: { mode: 'fixed', avgBlockTime: 1.022, blocksPerDay: 84540 },
      fuji: { mode: 'fixed', avgBlockTime: 2.268, blocksPerDay: 38113 },
      linea: { mode: 'fixed', avgBlockTime: 2.5, blocksPerDay: 34560 },
      scroll: {
        mode: 'periods',
        periods: [
          {
            startBlock: 0,
            endBlock: 24965736,
            avgBlockTime: 3,
            blocksPerDay: 28800,
            description: 'Classic',
          },
          {
            startBlock: 24965737,
            endBlock: Number.POSITIVE_INFINITY,
            avgBlockTime: 1,
            blocksPerDay: 86400,
            description: 'Upgrade',
          },
        ],
      },
      arbitrum: {
        mode: 'periods',
        periods: [
          {
            startBlock: 0,
            endBlock: 22207817,
            avgBlockTime: 13.5,
            blocksPerDay: 6400,
            description: 'Classic',
          },
          {
            startBlock: 22207818,
            endBlock: 58000000,
            avgBlockTime: 1,
            blocksPerDay: 86400,
            description: 'Upgrade 1',
          },
          {
            startBlock: 58000001,
            endBlock: Number.POSITIVE_INFINITY,
            avgBlockTime: 0.25,
            blocksPerDay: 345600,
            description: 'Upgrade 2',
          },
        ],
      },
    },
  }),
);
