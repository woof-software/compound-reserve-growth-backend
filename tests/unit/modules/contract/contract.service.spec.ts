import { Algorithm } from '@/common/enum/algorithm.enum';
import { AssetEntity } from '@/modules/asset/asset.entity';
import { ContractService } from '@/modules/contract/contract.service';
import { SourceEntity } from '@/modules/source/source.entity';

describe('ContractService', () => {
  const makeAsset = (id: number): AssetEntity => {
    const asset = new AssetEntity(
      '0x0000000000000000000000000000000000000001',
      18,
      'USDC',
      'eth',
      'erc20',
    );
    asset.id = id;
    return asset;
  };

  const makeSource = (params: {
    id: number;
    startBlock: number;
    endBlock?: number;
  }): SourceEntity => {
    const asset = makeAsset(1);
    const source = new SourceEntity(
      '0x0000000000000000000000000000000000000010',
      'eth',
      [Algorithm.COMET],
      'treasury',
      params.startBlock,
      asset,
      undefined,
      params.endBlock,
    );
    source.id = params.id;
    source.asset = asset;
    return source;
  };

  const makeDeps = () => {
    const findLatestReserveBySource = jest.fn();
    const historyService = {
      findLatestReserveBySource,
      createReservesWithSource: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {};
    const providerFactory = { get: jest.fn().mockReturnValue(provider) };
    const networkService = { getFinalityConfirmations: jest.fn().mockReturnValue(64) };
    const priceService = { getHistoricalPrice: jest.fn() };
    const algorithmService = { comet: jest.fn(), marketV2: jest.fn() };
    const mailService = { notifyGetHistoryError: jest.fn() };
    const cacheManager = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const redisClient = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const service = new ContractService(
      cacheManager as never,
      redisClient as never,
      providerFactory as never,
      networkService as never,
      historyService as never,
      priceService as never,
      algorithmService as never,
      mailService as never,
    );

    return {
      service,
      findLatestReserveBySource,
      providerFactory,
      historyService,
      priceService,
      mailService,
      redisClient,
      provider,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveReserves', () => {
    it('uses source.startBlock when source has no reserves in DB (fallback path)', async () => {
      const { service, findLatestReserveBySource } = makeDeps();
      const source = makeSource({ id: 10, startBlock: 5_000 });
      findLatestReserveBySource.mockResolvedValue(null);

      const getCachedBlockSpy = jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: 5_000,
          timestamp: Math.floor(Date.now() / 1000),
          hash: '0x',
        });

      await service.saveReserves(source, Algorithm.COMET);

      expect(findLatestReserveBySource).toHaveBeenCalledWith(source);
      expect(getCachedBlockSpy).toHaveBeenCalledWith('eth', expect.anything(), 5_000);
    });

    it('uses latest reserve blockNumber when source has reserves in DB (resume path)', async () => {
      const { service, findLatestReserveBySource } = makeDeps();
      const source = makeSource({ id: 20, startBlock: 1_000 });
      const latestReserve = {
        id: 1,
        blockNumber: 50_000,
        sourceId: 20,
      };
      findLatestReserveBySource.mockResolvedValue(latestReserve);

      const getCachedBlockSpy = jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: 50_000,
          timestamp: Math.floor(Date.now() / 1000),
          hash: '0x',
        });

      await service.saveReserves(source, Algorithm.COMET);

      expect(findLatestReserveBySource).toHaveBeenCalledWith(source);
      expect(getCachedBlockSpy).toHaveBeenCalledWith('eth', expect.anything(), 50_000);
    });

    it('uses source.startBlock when provided startDate is older than start block timestamp', async () => {
      const { service, findLatestReserveBySource } = makeDeps();
      const source = makeSource({ id: 30, startBlock: 9_000 });
      const olderThanStartBlock = new Date('2020-01-01T00:00:00.000Z');

      const getCachedBlockSpy = jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: source.startBlock,
          timestamp: Math.floor(Date.now() / 1000) + 2 * 86_400,
          hash: '0x',
        });

      const findBlockByTimestampSpy = jest.spyOn(
        service as unknown as { findBlockByTimestamp: jest.Mock },
        'findBlockByTimestamp',
      );

      await service.saveReserves(source, Algorithm.COMET, olderThanStartBlock);

      expect(findLatestReserveBySource).not.toHaveBeenCalled();
      expect(findBlockByTimestampSpy).not.toHaveBeenCalled();
      expect(getCachedBlockSpy).toHaveBeenCalledWith('eth', expect.anything(), source.startBlock);
    });

    it('caps start block to source.endBlock when startDate resolves to a higher block', async () => {
      const { service, findLatestReserveBySource } = makeDeps();
      const source = makeSource({ id: 31, startBlock: 1_000, endBlock: 5_555 });
      const startDate = new Date('2030-01-01T00:00:00.000Z');

      const getCachedBlockSpy = jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: source.endBlock as number,
          timestamp: Math.floor(Date.now() / 1000) + 2 * 86_400,
          hash: '0x',
        });

      const findBlockByTimestampSpy = jest
        .spyOn(service as unknown as { findBlockByTimestamp: jest.Mock }, 'findBlockByTimestamp')
        .mockResolvedValue(9_999);

      await service.saveReserves(source, Algorithm.COMET, startDate);

      expect(findLatestReserveBySource).not.toHaveBeenCalled();
      expect(findBlockByTimestampSpy).toHaveBeenCalledTimes(1);
      expect(getCachedBlockSpy).toHaveBeenCalledWith('eth', expect.anything(), source.endBlock);
    });

    it('returns early when firstMidnightUTC is greater than todayMidnightUTC', async () => {
      const { service, findLatestReserveBySource, historyService, priceService, mailService } =
        makeDeps();
      const source = makeSource({ id: 32, startBlock: 7_000 });
      findLatestReserveBySource.mockResolvedValue({ blockNumber: 7_000 });

      jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: 7_000,
          timestamp: Math.floor(Date.now() / 1000) + 2 * 86_400,
          hash: '0x',
        });

      await service.saveReserves(source, Algorithm.COMET);

      expect(findLatestReserveBySource).toHaveBeenCalledWith(source);
      expect(historyService.createReservesWithSource).not.toHaveBeenCalled();
      expect(priceService.getHistoricalPrice).not.toHaveBeenCalled();
      expect(mailService.notifyGetHistoryError).not.toHaveBeenCalled();
    });

    it('stops daily processing after reaching endBlock and does not write duplicate future-day rows', async () => {
      const { service, findLatestReserveBySource, historyService, priceService, provider } =
        makeDeps();
      const source = makeSource({ id: 33, startBlock: 1_000, endBlock: 100 });
      source.asset.symbol = 'ETH';

      findLatestReserveBySource.mockResolvedValue({ blockNumber: 90 });
      (provider as { getBalance?: jest.Mock }).getBalance = jest
        .fn()
        .mockResolvedValue(1_000_000_000_000_000_000n);
      priceService.getHistoricalPrice.mockResolvedValue(1);

      jest
        .spyOn(service as unknown as { getCachedBlock: jest.Mock }, 'getCachedBlock')
        .mockResolvedValue({
          blockNumber: 90,
          timestamp: Math.floor(Date.now() / 1000) - 3 * 86_400,
          hash: '0x',
        });

      const findBlockByTimestampSpy = jest
        .spyOn(service as unknown as { findBlockByTimestamp: jest.Mock }, 'findBlockByTimestamp')
        .mockResolvedValueOnce(95)
        .mockResolvedValueOnce(120)
        .mockResolvedValue(130);

      await service.saveReserves(source, Algorithm.ETH_WALLET);

      expect(findBlockByTimestampSpy).toHaveBeenCalledTimes(2);
      expect(historyService.createReservesWithSource).toHaveBeenCalledTimes(2);

      const firstReserve = historyService.createReservesWithSource.mock.calls[0][0] as {
        blockNumber: number;
      };
      const secondReserve = historyService.createReservesWithSource.mock.calls[1][0] as {
        blockNumber: number;
      };

      expect(firstReserve.blockNumber).toBe(95);
      expect(secondReserve.blockNumber).toBe(100);
    });

    it('returns early when latest stored block already reached source.endBlock', async () => {
      const { service, findLatestReserveBySource, historyService, priceService } = makeDeps();
      const source = makeSource({ id: 34, startBlock: 1_000, endBlock: 10_000 });

      findLatestReserveBySource.mockResolvedValue({ blockNumber: 10_000 });

      const getCachedBlockSpy = jest.spyOn(
        service as unknown as { getCachedBlock: jest.Mock },
        'getCachedBlock',
      );
      const findBlockByTimestampSpy = jest.spyOn(
        service as unknown as { findBlockByTimestamp: jest.Mock },
        'findBlockByTimestamp',
      );

      await service.saveReserves(source, Algorithm.COMET);

      expect(getCachedBlockSpy).not.toHaveBeenCalled();
      expect(findBlockByTimestampSpy).not.toHaveBeenCalled();
      expect(historyService.createReservesWithSource).not.toHaveBeenCalled();
      expect(priceService.getHistoricalPrice).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('dispatches COMET_STATS to saveStats and unknown algorithm to saveReserves', async () => {
      const { service } = makeDeps();
      const source = makeSource({ id: 40, startBlock: 1_000 });
      source.algorithm = [Algorithm.COMET_STATS, 'custom-algorithm'];

      const saveStatsSpy = jest.spyOn(service, 'saveStats').mockResolvedValue(undefined);
      const saveReservesSpy = jest.spyOn(service, 'saveReserves').mockResolvedValue(undefined);

      await service.getHistory(source);

      expect(saveStatsSpy).toHaveBeenCalledTimes(1);
      expect(saveStatsSpy).toHaveBeenCalledWith(source, Algorithm.COMET_STATS);
      expect(saveReservesSpy).toHaveBeenCalledTimes(1);
      expect(saveReservesSpy).toHaveBeenCalledWith(source, 'custom-algorithm');
    });
  });

  describe('onModuleInit', () => {
    it('initializes redis by pinging on startup', async () => {
      const { service, redisClient } = makeDeps();

      await service.onModuleInit();

      expect(redisClient.ping).toHaveBeenCalledTimes(1);
    });
  });
});
