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
    endBlock?: number | null;
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
      params.endBlock ?? null,
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
    const priceService = { getHistoricalPrice: jest.fn() };
    const algorithmService = { comet: jest.fn(), marketV2: jest.fn() };
    const mailService = { notifyGetHistoryError: jest.fn() };
    const cacheManager = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const redisClient = { get: jest.fn().mockResolvedValue(null), setex: jest.fn() };

    const service = new ContractService(
      cacheManager as never,
      redisClient as never,
      providerFactory as never,
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
  });
});
