import { ethers } from 'ethers';

import { CollateralPriceService } from '@/modules/price/collateral-price.service';

describe('CollateralPriceService', () => {
  const makeService = () => {
    const provider = { network: 'mainnet' };
    const providerFactory = {
      multicall: jest.fn().mockReturnValue(provider),
    };
    const feedPriceService = {
      readFeed: jest.fn(),
      resolveUsdPrice: jest.fn(),
    };

    const service = new CollateralPriceService(providerFactory as never, feedPriceService as never);

    return {
      feedPriceService,
      provider,
      providerFactory,
      service,
    };
  };

  const mockContracts = (contracts: Record<string, unknown>) => {
    const contractCtor = jest.fn().mockImplementation((address: string) => {
      const contract = contracts[address.toLowerCase()];
      if (!contract) {
        throw new Error(`Unexpected contract address: ${address}`);
      }
      return contract;
    });

    jest
      .spyOn(ethers, 'Contract', 'get')
      .mockReturnValue(contractCtor as unknown as typeof ethers.Contract);

    return contractCtor;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('reads comet collateral context and delegates USD resolution to FeedPriceService', async () => {
    const { feedPriceService, provider, providerFactory, service } = makeService();
    const date = new Date('2024-10-01T00:00:00.000Z');

    const cometContract = {
      getAssetInfoByAddress: jest.fn().mockResolvedValue({
        priceFeed: '0xasset-feed',
      }),
      baseTokenPriceFeed: jest.fn().mockResolvedValue('0xbase-feed'),
    };

    mockContracts({
      '0xcomet': cometContract,
    });
    const snapshot = {
      address: '0xasset-feed',
      description: 'cbBTC / ETH price feed',
      kind: 'quoted',
      price: 31.84876098,
      quoteSymbol: 'ETH',
    };
    feedPriceService.readFeed.mockResolvedValue(snapshot);
    feedPriceService.resolveUsdPrice.mockResolvedValue(116103.22);

    const result = await service.getPrice({
      assetAddress: '0xasset',
      assetSymbol: 'cbBTC',
      blockTag: 55_555,
      cometAddress: '0xcomet',
      date,
      network: 'mainnet',
    });

    expect(providerFactory.multicall).toHaveBeenCalledWith('mainnet');
    expect(cometContract.getAssetInfoByAddress).toHaveBeenCalledWith('0xasset', {
      blockTag: 55_555,
    });
    expect(cometContract.baseTokenPriceFeed).toHaveBeenCalledWith({ blockTag: 55_555 });
    expect(feedPriceService.readFeed).toHaveBeenCalledWith({
      assetSymbol: 'cbBTC',
      blockTag: 55_555,
      date,
      defaultQuoteFeedAddress: '0xbase-feed',
      feedAddress: '0xasset-feed',
      network: 'mainnet',
    });
    expect(feedPriceService.resolveUsdPrice).toHaveBeenCalledWith(
      {
        assetSymbol: 'cbBTC',
        blockTag: 55_555,
        date,
        feedAddress: '0xasset-feed',
        network: 'mainnet',
        defaultQuoteFeedAddress: '0xbase-feed',
        defaultQuoteSymbol: undefined,
      },
      snapshot,
    );
    expect(result).toBe(116103.22);
    expect(provider).toEqual(expect.objectContaining({ network: 'mainnet' }));
  });

  it('throws when the comet asset has no configured price feed', async () => {
    const { service } = makeService();

    const cometContract = {
      getAssetInfoByAddress: jest.fn().mockResolvedValue({
        priceFeed: '',
      }),
      baseToken: jest.fn().mockResolvedValue('0xbase-token'),
      baseTokenPriceFeed: jest.fn().mockResolvedValue('0xbase-feed'),
    };
    const baseTokenContract = {
      symbol: jest.fn().mockResolvedValue('WETH'),
    };

    mockContracts({
      '0xcomet': cometContract,
      '0xbase-token': baseTokenContract,
    });

    await expect(
      service.getPrice({
        assetAddress: '0xasset',
        assetSymbol: 'cbBTC',
        blockTag: 1,
        cometAddress: '0xcomet',
        date: new Date('2024-10-01T00:00:00.000Z'),
        network: 'mainnet',
      }),
    ).rejects.toThrow('No price feed configured for collateral cbBTC');
  });

  it('wraps base token metadata failures with contextual errors', async () => {
    const { feedPriceService, service } = makeService();

    const cometContract = {
      getAssetInfoByAddress: jest.fn().mockResolvedValue({
        priceFeed: '0xasset-feed',
      }),
      baseToken: jest.fn().mockResolvedValue('0xbase-token'),
      baseTokenPriceFeed: jest.fn().mockResolvedValue('0xbase-feed'),
    };
    const baseTokenContract = {
      symbol: jest.fn().mockRejectedValue(new Error('symbol reverted')),
    };

    mockContracts({
      '0xcomet': cometContract,
      '0xbase-token': baseTokenContract,
    });
    feedPriceService.readFeed.mockResolvedValue({
      address: '0xasset-feed',
      description: 'Constant price feed',
      kind: 'constant',
      price: 1,
      quoteSymbol: null,
    });

    await expect(
      service.getPrice({
        assetAddress: '0xasset',
        assetSymbol: 'cbBTC',
        blockTag: 1,
        cometAddress: '0xcomet',
        date: new Date('2024-10-01T00:00:00.000Z'),
        network: 'mainnet',
      }),
    ).rejects.toThrow(
      'Failed to read base token metadata for cbBTC on 2024-10-01 block 1 network mainnet: symbol reverted',
    );
  });
});
