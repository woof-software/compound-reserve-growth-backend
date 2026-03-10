import { ethers } from 'ethers';

import { DiscoveryService } from '@/modules/oracle/discovery.service';

describe('DiscoveryService', () => {
  const makeService = () => {
    const providerFactory = {
      multicall: jest.fn().mockReturnValue({}),
    };
    const networkService = {
      byName: jest.fn(),
    };
    const blockService = {
      getSafeBlockNumber: jest.fn(),
    };
    const sourceRepository = {
      list: jest.fn(),
    };
    const oracleRepository = {
      upsert: jest.fn(),
    };

    const service = new DiscoveryService(
      providerFactory as never,
      networkService as never,
      blockService as never,
      sourceRepository as never,
      oracleRepository as never,
    );

    return {
      service,
      providerFactory,
      blockService,
      oracleRepository,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('loadCometAssetInfos', () => {
    it('loads all asset infos for a valid numeric numAssets value', async () => {
      const { service } = makeService();
      const internal = service as unknown as {
        loadCometAssetInfos: (
          cometAddress: string,
          network: string,
          cometContract: ethers.Contract,
          blockTag: number,
          numAssetsRaw: unknown,
        ) => Promise<Array<{ priceFeed: string }>>;
      };

      const cometContract = {
        getAssetInfo: jest
          .fn()
          .mockResolvedValueOnce({ priceFeed: '0x00000000000000000000000000000000000000a1' })
          .mockResolvedValueOnce({ priceFeed: '0x00000000000000000000000000000000000000a2' }),
      };

      const result = await internal.loadCometAssetInfos(
        '0x00000000000000000000000000000000000000c0',
        'mainnet',
        cometContract as never,
        101,
        2n,
      );

      expect(result).toEqual([
        { priceFeed: '0x00000000000000000000000000000000000000a1' },
        { priceFeed: '0x00000000000000000000000000000000000000a2' },
      ]);
      expect(cometContract.getAssetInfo).toHaveBeenCalledTimes(2);
      expect(cometContract.getAssetInfo).toHaveBeenNthCalledWith(1, 0, { blockTag: 101 });
      expect(cometContract.getAssetInfo).toHaveBeenNthCalledWith(2, 1, { blockTag: 101 });
    });

    it('returns an empty list when numAssets is zero', async () => {
      const { service } = makeService();
      const internal = service as unknown as {
        loadCometAssetInfos: (
          cometAddress: string,
          network: string,
          cometContract: ethers.Contract,
          blockTag: number,
          numAssetsRaw: unknown,
        ) => Promise<Array<{ priceFeed: string }>>;
      };

      const cometContract = {
        getAssetInfo: jest.fn(),
      };

      const result = await internal.loadCometAssetInfos(
        '0x00000000000000000000000000000000000000c0',
        'mainnet',
        cometContract as never,
        101,
        0n,
      );

      expect(result).toEqual([]);
      expect(cometContract.getAssetInfo).not.toHaveBeenCalled();
    });

    it('throws for invalid numAssetsRaw values', async () => {
      const { service } = makeService();
      const internal = service as unknown as {
        loadCometAssetInfos: (
          cometAddress: string,
          network: string,
          cometContract: ethers.Contract,
          blockTag: number,
          numAssetsRaw: unknown,
        ) => Promise<Array<{ priceFeed: string }>>;
      };

      await expect(
        internal.loadCometAssetInfos(
          '0x00000000000000000000000000000000000000c0',
          'mainnet',
          { getAssetInfo: jest.fn() } as never,
          101,
          'invalid',
        ),
      ).rejects.toThrow('Invalid numAssets value for comet');
    });
  });

  it('uses numAssets and getAssetInfo calls in discovery flow', async () => {
    const { service, blockService, providerFactory, oracleRepository } = makeService();
    blockService.getSafeBlockNumber.mockResolvedValue(555);

    const cometContract = {
      baseTokenPriceFeed: jest
        .fn()
        .mockResolvedValue('0x00000000000000000000000000000000000000b0'),
      numAssets: jest.fn().mockResolvedValue(2n),
      getAssetInfo: jest
        .fn()
        .mockResolvedValueOnce({ priceFeed: '0x00000000000000000000000000000000000000b1' })
        .mockResolvedValueOnce({ priceFeed: '0x00000000000000000000000000000000000000b2' }),
    };

    const contractCtor = jest.fn().mockImplementation(() => cometContract);
    jest
      .spyOn(ethers, 'Contract', 'get')
      .mockReturnValue(contractCtor as unknown as typeof ethers.Contract);

    const internal = service as unknown as {
      checkIfCapoOracle: (
        oracleAddress: string,
        chainId: number,
        network: string,
        blockTag: number,
      ) => Promise<null>;
    };
    const checkIfCapoOracleSpy = jest
      .spyOn(internal, 'checkIfCapoOracle')
      .mockResolvedValue(null);

    const result = await service.discoverCapoOracles([
      {
        address: '0x00000000000000000000000000000000000000c0',
        chainId: 1,
        network: 'mainnet',
      },
    ]);

    expect(result).toEqual([]);
    expect(providerFactory.multicall).toHaveBeenCalledWith('mainnet');
    expect(blockService.getSafeBlockNumber).toHaveBeenCalledWith('mainnet');
    expect(cometContract.baseTokenPriceFeed).toHaveBeenCalledWith({ blockTag: 555 });
    expect(cometContract.numAssets).toHaveBeenCalledWith({ blockTag: 555 });
    expect(cometContract.getAssetInfo).toHaveBeenCalledTimes(2);
    expect(cometContract.getAssetInfo).toHaveBeenNthCalledWith(1, 0, { blockTag: 555 });
    expect(cometContract.getAssetInfo).toHaveBeenNthCalledWith(2, 1, { blockTag: 555 });
    expect(checkIfCapoOracleSpy).toHaveBeenCalledTimes(3);
    expect(oracleRepository.upsert).not.toHaveBeenCalled();
  });
});
