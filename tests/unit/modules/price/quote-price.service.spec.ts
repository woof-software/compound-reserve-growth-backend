import { ethers } from 'ethers';

import type { NetworkConfig } from '@/common/chains/network/network.types';
import { QuotePriceService } from '@/modules/price/quote-price.service';

describe('QuotePriceService', () => {
  const networks: NetworkConfig[] = [
    {
      network: 'mainnet',
      chainId: 1,
      url: 'https://rpc.example/mainnet',
      quoteUsdFeeds: {
        ETH: '0xeth-mainnet-feed',
        BTC: '0xbtc-mainnet-feed',
      },
      wstEthAddress: '0xwsteth-mainnet',
    },
    {
      network: 'base',
      chainId: 8453,
      url: 'https://rpc.example/base',
      quoteUsdFeeds: {
        ETH: '0xeth-base-feed',
      },
    },
    {
      network: 'ronin',
      chainId: 2020,
      url: 'https://rpc.example/ronin',
      quoteUsdFeeds: {
        RON: '0xron-feed',
      },
    },
    {
      network: 'arbitrum',
      chainId: 42161,
      url: 'https://rpc.example/arbitrum',
    },
  ];

  const makeService = () => {
    const networkService = {
      byName: jest.fn((name: string) => {
        const network = networks.find((item) => item.network === name);
        if (!network) {
          throw new Error(`Network "${name}" is not configured`);
        }

        return network;
      }),
    };
    const providerFactory = {
      multicall: jest.fn((network: string) => ({ network })),
    };
    const blockService = {
      findBlockByTimestamp: jest.fn(),
    };

    const service = new QuotePriceService(
      networkService as never,
      providerFactory as never,
      blockService as never,
    );

    return {
      service,
      blockService,
      networkService,
      providerFactory,
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

  it('reads ETH/USD from the current network without cross-network block lookup', async () => {
    const { service, blockService, networkService, providerFactory } = makeService();
    const blockTag = 12_345;

    const ethBaseFeed = {
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 364_394_346_635n,
      }),
    };

    const contractCtor = mockContracts({
      '0xeth-base-feed': ethBaseFeed,
    });

    const result = await service.getUsdPrice({
      blockTag,
      date: new Date('2024-04-01T00:00:00.000Z'),
      network: 'base',
      symbol: 'WETH',
    });

    expect(networkService.byName).toHaveBeenCalledWith('base');
    expect(providerFactory.multicall).toHaveBeenCalledWith('base');
    expect(blockService.findBlockByTimestamp).not.toHaveBeenCalled();
    expect(contractCtor).toHaveBeenCalledWith(
      '0xeth-base-feed',
      expect.anything(),
      expect.objectContaining({ network: 'base' }),
    );
    expect(ethBaseFeed.decimals).toHaveBeenCalledWith({ blockTag });
    expect(ethBaseFeed.latestRoundData).toHaveBeenCalledWith({ blockTag });
    expect(result).toBeCloseTo(3643.94346635);
  });

  it('falls back to mainnet feed and resolves historical block for BTC/USD', async () => {
    const { service, blockService, networkService, providerFactory } = makeService();
    const date = new Date('2024-04-01T00:00:00.000Z');

    blockService.findBlockByTimestamp.mockResolvedValue(54_321);

    const btcMainnetFeed = {
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 7_125_400_000_000n,
      }),
    };

    mockContracts({
      '0xbtc-mainnet-feed': btcMainnetFeed,
    });

    const result = await service.getUsdPrice({
      blockTag: 1_234,
      date,
      network: 'arbitrum',
      symbol: 'WBTC',
    });

    expect(networkService.byName).toHaveBeenCalledWith('arbitrum');
    expect(networkService.byName).toHaveBeenCalledWith('mainnet');
    expect(providerFactory.multicall).toHaveBeenCalledWith('mainnet');
    expect(blockService.findBlockByTimestamp).toHaveBeenCalledWith(
      'mainnet',
      expect.objectContaining({ network: 'mainnet' }),
      Math.floor(date.getTime() / 1000),
    );
    expect(btcMainnetFeed.decimals).toHaveBeenCalledWith({ blockTag: 54_321 });
    expect(btcMainnetFeed.latestRoundData).toHaveBeenCalledWith({ blockTag: 54_321 });
    expect(result).toBe(71_254);
  });

  it('derives wstETH/USD from historical stEthPerToken and ETH/USD', async () => {
    const { service, blockService, networkService, providerFactory } = makeService();
    const date = new Date('2024-04-01T00:00:00.000Z');

    blockService.findBlockByTimestamp.mockResolvedValue(99_999);

    const wstEthContract = {
      stEthPerToken: jest.fn().mockResolvedValue(1_162_099_789_246_041_346n),
    };
    const ethMainnetFeed = {
      decimals: jest.fn().mockResolvedValue(8n),
      latestRoundData: jest.fn().mockResolvedValue({
        answer: 364_595_061_933n,
      }),
    };

    mockContracts({
      '0xwsteth-mainnet': wstEthContract,
      '0xeth-mainnet-feed': ethMainnetFeed,
    });

    const result = await service.getUsdPrice({
      blockTag: 222,
      date,
      network: 'base',
      symbol: 'wstETH',
    });

    const expected = 1.1620997892460414 * 3645.95061933;

    expect(providerFactory.multicall).toHaveBeenCalledWith('mainnet');
    expect(networkService.byName).toHaveBeenCalledWith('mainnet');
    expect(blockService.findBlockByTimestamp).toHaveBeenCalledTimes(1);
    expect(wstEthContract.stEthPerToken).toHaveBeenCalledWith({ blockTag: 99_999 });
    expect(ethMainnetFeed.latestRoundData).toHaveBeenCalledWith({ blockTag: 99_999 });
    expect(result).toBeCloseTo(expected);
  });

  it('throws for unsupported quote assets', async () => {
    const { service } = makeService();

    await expect(
      service.getUsdPrice({
        blockTag: 1,
        date: new Date('2024-04-01T00:00:00.000Z'),
        network: 'base',
        symbol: 'AERO',
      }),
    ).rejects.toThrow('Unsupported quote asset for USD resolution: AERO');
  });
});
