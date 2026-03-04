import { BlockService } from '@/common/chains/block/block.service';
import type { BlockTimingConfigData } from '@/common/chains/block/block.types';

describe('BlockService', () => {
  const createTimingConfig = (extraNetworks: BlockTimingConfigData['networks'] = {}) => ({
    networks: {
      mainnet: { mode: 'fixed' as const, avgBlockTime: 12, blocksPerDay: 7200 },
      linea: { mode: 'fixed' as const, avgBlockTime: 2.5, blocksPerDay: 34560 },
      scroll: {
        mode: 'periods' as const,
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
        mode: 'periods' as const,
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
      ...extraNetworks,
    },
  });

  const makeDeps = (params?: {
    timingConfig?: BlockTimingConfigData;
    networkNames?: string[];
    configService?: { get: jest.Mock };
    redisClient?: Record<string, unknown>;
  }) => {
    const timingConfig = params?.timingConfig ?? createTimingConfig();

    const cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const redisClient =
      params?.redisClient ??
      ({
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        ping: jest.fn().mockResolvedValue('PONG'),
      } as const);

    const provider = {
      getBlock: jest.fn().mockResolvedValue({ number: 1000 }),
      getBlockNumber: jest.fn().mockResolvedValue(1000),
    };

    const providerFactory = {
      get: jest.fn().mockReturnValue(provider),
    };

    const networkNames = params?.networkNames ?? Object.keys(timingConfig.networks);
    const networkService = {
      all: jest.fn().mockReturnValue(networkNames.map((network) => ({ network }))),
    };

    const configService =
      params?.configService ??
      ({
        get: jest.fn((key: string) => (key === 'blockTiming' ? timingConfig : undefined)),
      } as const);

    const service = new BlockService(
      cacheManager as never,
      redisClient as never,
      configService as never,
      providerFactory as never,
      networkService as never,
    );

    return {
      service,
      cacheManager,
      redisClient,
      provider,
      providerFactory,
      networkService,
      configService,
      timingConfig,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('validates config and initializes redis by pinging once', async () => {
      const { service, redisClient } = makeDeps();

      await service.onModuleInit();

      expect((redisClient as { ping: jest.Mock }).ping).toHaveBeenCalledTimes(1);
    });

    it('throws a clear error when some networks are missing in block timing config', async () => {
      const { service, redisClient } = makeDeps({ networkNames: ['mainnet', 'polygon'] });

      await expect(service.onModuleInit()).rejects.toThrow(
        'Missing networks in blockTiming: polygon',
      );
      expect((redisClient as { ping: jest.Mock }).ping).not.toHaveBeenCalled();
    });

    it('logs warning when block timing has extra networks not present in network config', async () => {
      const { service } = makeDeps({
        timingConfig: createTimingConfig({
          base: { mode: 'fixed', avgBlockTime: 2, blocksPerDay: 43200 },
        }),
        networkNames: ['mainnet', 'linea', 'scroll', 'arbitrum'],
      });

      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (message: string) => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Block timing contains extra networks not present in network config: base.',
        ),
      );
    });
  });

  describe('getSafeBlockNumber', () => {
    it('returns latest block minus 15m offset in blocks', async () => {
      const { service, provider, providerFactory } = makeDeps();
      provider.getBlock.mockResolvedValue({ number: 1000 });

      const result = await service.getSafeBlockNumber('mainnet');

      expect(result).toBe(925);
      expect(providerFactory.get).toHaveBeenCalledWith('mainnet');
      expect(provider.getBlock).toHaveBeenCalledWith('latest');
    });

    it('clamps safe block number to zero when time-based offset exceeds latest block', async () => {
      const { service, provider } = makeDeps();
      provider.getBlock.mockResolvedValue({ number: 10 });

      const result = await service.getSafeBlockNumber('mainnet');

      expect(result).toBe(0);
    });

    it('throws when latest block cannot be fetched', async () => {
      const { service, provider } = makeDeps();
      provider.getBlock.mockResolvedValue(null);

      await expect(service.getSafeBlockNumber('mainnet')).rejects.toThrow(
        'Could not fetch latest block for network mainnet',
      );
    });
  });

  describe('getBlockOffsetByTime', () => {
    it('returns block offset by average block time for fixed network', async () => {
      const { service } = makeDeps();

      const result = await service.getBlockOffsetByTime('mainnet', 900);

      expect(result).toBe(75);
    });

    it('returns block offset for the latest period in period-based network', async () => {
      const { service, provider } = makeDeps();
      provider.getBlock.mockResolvedValue({ number: 58_000_050 });

      const result = await service.getBlockOffsetByTime('arbitrum', 900);

      expect(result).toBe(3600);
    });

    it('returns zero offset for non-positive time', async () => {
      const { service } = makeDeps();

      const result = await service.getBlockOffsetByTime('mainnet', 0);

      expect(result).toBe(0);
    });
  });

  describe('getCachedBlock', () => {
    it('returns data from redis cache without calling provider', async () => {
      const { service, redisClient, provider } = makeDeps();
      (redisClient as { get: jest.Mock }).get.mockResolvedValue(
        JSON.stringify({
          blockNumber: 100,
          timestamp: 12345,
          hash: '0xabc',
          cachedAt: 111,
        }),
      );

      const result = await service.getCachedBlock('mainnet', provider as never, 100);

      expect(result).toEqual({ blockNumber: 100, timestamp: 12345, hash: '0xabc' });
      expect(provider.getBlock).not.toHaveBeenCalled();
    });

    it('fetches block from provider and caches it when cache miss happens', async () => {
      const { service, redisClient, provider } = makeDeps();
      (redisClient as { get: jest.Mock }).get.mockResolvedValue(null);
      provider.getBlock.mockResolvedValue({ number: 77, timestamp: 98765, hash: '0xdef' });

      const result = await service.getCachedBlock('mainnet', provider as never, 77);

      expect(result).toEqual({ blockNumber: 77, timestamp: 98765, hash: '0xdef' });
      expect((redisClient as { setex: jest.Mock }).setex).toHaveBeenCalledTimes(1);
      expect((redisClient as { setex: jest.Mock }).setex).toHaveBeenCalledWith(
        'block:mainnet:77',
        2592000,
        expect.any(String),
      );
    });

    it('falls back to cache manager when redis get method is not available', async () => {
      const { service, cacheManager, provider } = makeDeps({
        redisClient: {
          ping: jest.fn().mockResolvedValue('PONG'),
          setex: jest.fn().mockResolvedValue('OK'),
        },
      });

      cacheManager.get.mockResolvedValue(
        JSON.stringify({
          blockNumber: 5,
          timestamp: 500,
          hash: '0x5',
          cachedAt: 1,
        }),
      );

      const result = await service.getCachedBlock('mainnet', provider as never, 5);

      expect(result).toEqual({ blockNumber: 5, timestamp: 500, hash: '0x5' });
      expect(cacheManager.get).toHaveBeenCalledWith('block:mainnet:5');
      expect(provider.getBlock).not.toHaveBeenCalled();
    });

    it('ignores invalid cached payload and refetches block from provider', async () => {
      const { service, redisClient, provider } = makeDeps();
      (redisClient as { get: jest.Mock }).get.mockResolvedValue('{"wrong":true}');
      provider.getBlock.mockResolvedValue({ number: 15, timestamp: 1500, hash: '0x15' });

      const result = await service.getCachedBlock('mainnet', provider as never, 15);

      expect(result).toEqual({ blockNumber: 15, timestamp: 1500, hash: '0x15' });
      expect(provider.getBlock).toHaveBeenCalledWith(15);
    });

    it('throws when provider returns empty block or block hash is missing', async () => {
      const { service, redisClient, provider } = makeDeps();
      (redisClient as { get: jest.Mock }).get.mockResolvedValue(null);
      provider.getBlock.mockResolvedValue({ number: 1, timestamp: 1, hash: null });

      await expect(service.getCachedBlock('mainnet', provider as never, 1)).rejects.toThrow(
        'Could not fetch block 1',
      );
    });
  });

  describe('findBlockByTimestamp', () => {
    it('delegates to arbitrum strategy for wide ranges', async () => {
      const { service, provider } = makeDeps();
      const arbitrumSpy = jest
        .spyOn(
          service as unknown as { findArbitrumBlockByTimestamp: jest.Mock },
          'findArbitrumBlockByTimestamp',
        )
        .mockResolvedValue(777);

      const result = await service.findBlockByTimestamp(
        'arbitrum',
        provider as never,
        10_000,
        0,
        200_001,
      );

      expect(result).toBe(777);
      expect(arbitrumSpy).toHaveBeenCalledWith(provider, 10_000, 0, 200_001);
    });

    it('delegates to scroll strategy for scroll network', async () => {
      const { service, provider } = makeDeps();
      const scrollSpy = jest
        .spyOn(
          service as unknown as { findScrollBlockByTimestamp: jest.Mock },
          'findScrollBlockByTimestamp',
        )
        .mockResolvedValue(333);

      const result = await service.findBlockByTimestamp(
        'scroll',
        provider as never,
        10_000,
        0,
        100_000,
      );

      expect(result).toBe(333);
      expect(scrollSpy).toHaveBeenCalledWith(provider, 10_000, 0, 100_000);
    });

    it('returns estimated block when timestamp difference is within allowed slip', async () => {
      const { service, provider } = makeDeps();

      const getCachedBlockSpy = jest
        .spyOn(service, 'getCachedBlock')
        .mockResolvedValueOnce({ blockNumber: 100, timestamp: 1000, hash: '0x1' })
        .mockResolvedValueOnce({ blockNumber: 130, timestamp: 1400, hash: '0x2' });

      const binarySearchSpy = jest.spyOn(
        service as unknown as { binarySearchWithCache: jest.Mock },
        'binarySearchWithCache',
      );

      const result = await service.findBlockByTimestamp(
        'mainnet',
        provider as never,
        1360,
        100,
        200,
      );

      expect(result).toBe(130);
      expect(getCachedBlockSpy).toHaveBeenCalledTimes(2);
      expect(binarySearchSpy).not.toHaveBeenCalled();
    });

    it('falls back to binary search when estimate is outside allowed slip', async () => {
      const { service, provider } = makeDeps();

      jest
        .spyOn(service, 'getCachedBlock')
        .mockResolvedValueOnce({ blockNumber: 100, timestamp: 1000, hash: '0x1' })
        .mockResolvedValueOnce({ blockNumber: 130, timestamp: 6000, hash: '0x2' });

      const binarySearchSpy = jest
        .spyOn(service as unknown as { binarySearchWithCache: jest.Mock }, 'binarySearchWithCache')
        .mockResolvedValue(150);

      const result = await service.findBlockByTimestamp(
        'mainnet',
        provider as never,
        1360,
        100,
        200,
      );

      expect(result).toBe(150);
      expect(binarySearchSpy).toHaveBeenCalledWith(
        'mainnet',
        provider,
        1360,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('getBlocksPerDay', () => {
    it('returns fixed network blocksPerDay for fixed-mode networks', () => {
      const { service } = makeDeps();

      expect(service.getBlocksPerDay('mainnet', 1)).toBe(7200);
    });

    it('returns period-specific blocksPerDay for period-mode networks', () => {
      const { service } = makeDeps();

      expect(service.getBlocksPerDay('arbitrum', 1)).toBe(6400);
      expect(service.getBlocksPerDay('arbitrum', 58_000_050)).toBe(345600);
    });

    it('throws clear error for unknown networks', () => {
      const { service } = makeDeps();

      expect(() => service.getBlocksPerDay('unknown-network', 1)).toThrow(
        'Block timing is not configured for network: unknown-network',
      );
    });

    it('throws clear error when blockTiming config key is missing', () => {
      const { service } = makeDeps({
        configService: {
          get: jest.fn().mockReturnValue(undefined),
        },
      });

      expect(() => service.getBlocksPerDay('mainnet', 1)).toThrow(
        'Block timing configuration is missing at config key "blockTiming"',
      );
    });
  });
});
