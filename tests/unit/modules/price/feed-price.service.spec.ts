import { ethers } from 'ethers';

import { FeedPriceService } from '@/modules/price/feed-price.service';

describe('FeedPriceService', () => {
  const makeService = () => {
    const providerFactory = {
      multicall: jest.fn((network: string) => ({ network })),
    };
    const quotePriceService = {
      getUsdPrice: jest.fn(),
    };

    const service = new FeedPriceService(providerFactory as never, quotePriceService as never);

    return {
      service,
      providerFactory,
      quotePriceService,
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

  it('returns direct USD feed prices without quote resolution', async () => {
    const { providerFactory, service, quotePriceService } = makeService();

    const directUsdFeed = {
      description: jest.fn().mockResolvedValue('Calculated MaticX / USD'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 11_188_216n,
      }),
    };

    mockContracts({
      '0xdirect-feed': directUsdFeed,
    });

    const result = await service.getUsdPrice({
      assetSymbol: 'MaticX',
      blockTag: 77,
      date: new Date('2024-04-01T00:00:00.000Z'),
      feedAddress: '0xdirect-feed',
      network: 'polygon',
    });

    expect(result).toBeCloseTo(0.11188216);
    expect(quotePriceService.getUsdPrice).not.toHaveBeenCalled();
    expect(providerFactory.multicall).toHaveBeenCalledWith('polygon');
  });

  it('multiplies quoted feeds by the resolved quote USD price', async () => {
    const { service, quotePriceService } = makeService();
    quotePriceService.getUsdPrice.mockResolvedValue(3645.95061933);

    const quotedEthFeed = {
      description: jest.fn().mockResolvedValue('cbBTC / ETH price feed'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 3_184_876_098n,
      }),
    };

    mockContracts({
      '0xquoted-feed': quotedEthFeed,
    });

    const result = await service.getUsdPrice({
      assetSymbol: 'cbBTC',
      blockTag: 88,
      date: new Date('2024-04-01T00:00:00.000Z'),
      feedAddress: '0xquoted-feed',
      network: 'mainnet',
    });

    expect(quotePriceService.getUsdPrice).toHaveBeenCalledWith({
      blockTag: 88,
      date: new Date('2024-04-01T00:00:00.000Z'),
      network: 'mainnet',
      symbol: 'ETH',
    });
    expect(result).toBeCloseTo(31.84876098 * 3645.95061933);
  });

  it('resolves constant feeds through the provided default quote feed', async () => {
    const { service, quotePriceService } = makeService();

    const constantFeed = {
      description: jest.fn().mockResolvedValue('Constant price feed'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 100_000_000n,
      }),
    };
    const baseUsdFeed = {
      description: jest.fn().mockResolvedValue('USDC / USD'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 99_970_000n,
      }),
    };

    mockContracts({
      '0xconstant-feed': constantFeed,
      '0xbase-feed': baseUsdFeed,
    });

    const result = await service.getUsdPrice({
      assetSymbol: 'wUSDM',
      blockTag: 99,
      date: new Date('2024-04-01T00:00:00.000Z'),
      feedAddress: '0xconstant-feed',
      network: 'optimism',
      defaultQuoteFeedAddress: '0xbase-feed',
      defaultQuoteSymbol: 'USDC',
    });

    expect(result).toBeCloseTo(0.9997);
    expect(quotePriceService.getUsdPrice).not.toHaveBeenCalled();
  });

  it('accepts unknown descriptions as direct USD only when asset and default quote match', async () => {
    const { service } = makeService();

    const customFeed = {
      description: jest.fn().mockResolvedValue('Custom cbBTC oracle'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 6_788_688_793_556n,
      }),
    };

    mockContracts({
      '0xcustom-feed': customFeed,
    });

    const result = await service.getUsdPrice({
      assetSymbol: 'cbBTC',
      blockTag: 100,
      date: new Date('2024-04-01T00:00:00.000Z'),
      feedAddress: '0xcustom-feed',
      network: 'base',
      defaultQuoteSymbol: 'cbBTC',
    });

    expect(result).toBeCloseTo(67886.88793556);
  });

  it('throws for unsupported unknown feed descriptions', async () => {
    const { service } = makeService();

    const customFeed = {
      description: jest.fn().mockResolvedValue('Custom cbBTC oracle'),
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 6_788_688_793_556n,
      }),
    };

    mockContracts({
      '0xcustom-feed': customFeed,
    });

    await expect(
      service.getUsdPrice({
        assetSymbol: 'cbBTC',
        blockTag: 100,
        date: new Date('2024-04-01T00:00:00.000Z'),
        feedAddress: '0xcustom-feed',
        network: 'base',
        defaultQuoteSymbol: 'WETH',
      }),
    ).rejects.toThrow(
      'Unsupported feed description "Custom cbBTC oracle" for cbBTC using 0xcustom-feed',
    );
  });
});
