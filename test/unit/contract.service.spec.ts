import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ethers } from 'ethers';

import { ContractService } from '../../src/modules/contract/contract.service';
import { ProviderFactory } from '../../src/modules/network/provider.factory';
import { HistoryService } from '../../src/modules/history/history.service';
import { SourceService } from '../../src/modules/source/source.service';
import { PriceService } from '../../src/modules/price/price.service';
import { MailService } from '../../src/modules/mail/mail.service';
import { REDIS_CLIENT } from '../../src/modules/redis/redis.module';

// Fix BigInt serialization for Jest
BigInt.prototype.toJSON = function () {
  return this.toString();
};

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');

  const ContractMock = jest.fn();
  const contractInstances: any[] = [];

  // Helper to enqueue instances to be returned by new Contract()
  (ContractMock as any).__setNextInstances = (instances: any[]) => {
    contractInstances.splice(0, contractInstances.length, ...instances);
  };

  (ContractMock as any).mockImplementation(() => {
    if (contractInstances.length > 0) {
      return contractInstances.shift();
    }
    return {};
  });

  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: ContractMock,
      toUtf8String: (value: any) => {
        // Very small shim for test purposes
        if (typeof value === 'string') return value.replace(/\u0000/g, '');
        return 'SYMBOL';
      },
    },
    JsonRpcProvider: actual.JsonRpcProvider,
  };
});

describe('ContractService', () => {
  let service: ContractService;

  const cacheManagerMock: Partial<Cache> = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const redisMock: any = {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    setex: jest.fn(),
  };

  const providerFactoryMock = {
    get: jest.fn(),
  } as unknown as ProviderFactory;

  const historyServiceMock = {
    createReservesWithSource: jest.fn(),
    createIncomesWithSource: jest.fn(),
    createSpendsWithSource: jest.fn(),
  } as unknown as HistoryService;

  const sourceServiceMock = {
    updateWithSource: jest.fn(),
  } as unknown as SourceService;

  const priceServiceMock = {
    getHistoricalPrice: jest.fn(),
  } as unknown as PriceService;

  const mailServiceMock = {
    notifyGetHistoryError: jest.fn(),
  } as unknown as MailService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        { provide: REDIS_CLIENT, useValue: redisMock },
        { provide: ProviderFactory, useValue: providerFactoryMock },
        { provide: HistoryService, useValue: historyServiceMock },
        { provide: SourceService, useValue: sourceServiceMock },
        { provide: PriceService, useValue: priceServiceMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
    await service.onModuleInit();
  });

  describe('readMarketData', () => {
    it('should read basic data using provider and contracts', async () => {
      const mockProvider: any = {};
      (providerFactoryMock.get as any) = jest.fn().mockReturnValue(mockProvider);

      // First Contract() for comet: returns extensionDelegate()
      const cometInstance = {
        extensionDelegate: jest.fn().mockResolvedValue('0xExtDelegate'),
      };
      // Second Contract() for extension: returns symbol()
      const extensionInstance = {
        symbol: jest.fn().mockResolvedValue('cUSDCV3'),
      };

      (ethers as any).Contract.__setNextInstances([cometInstance, extensionInstance]);

      const root = {
        comet: '0xComet',
        rewards: '0xRewards',
        networkPath: 'base/comet',
      } as any;

      const res = await service.readMarketData(root, 'base/comet');
      expect(res.network).toBe('base');
      expect(res.market).toBe('cUSDCV3');
      expect(res.cometAddress).toBe('0xComet');
      expect(res.rewardsAddress).toBe('0xRewards');
      expect(res.provider).toBe(mockProvider);
    });
  });

  describe('getMarketV2UnderlyingToken', () => {
    it('should return ETH info for special native ETH market', async () => {
      const res = await service.getMarketV2UnderlyingToken(
        '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
        'mainnet',
      );
      expect(res).toEqual({
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
      });
    });

    it('should return decoded bytes32 symbol when applicable', async () => {
      const mockProvider: any = {};
      (providerFactoryMock.get as any) = jest.fn().mockReturnValue(mockProvider);

      const marketInstance = {
        underlying: jest.fn().mockResolvedValue('0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'),
      };
      const tokenInstance = {
        symbol: jest.fn().mockResolvedValue('MKR\u0000\u0000'),
        decimals: jest.fn().mockResolvedValue(18),
      };
      (ethers as any).Contract.__setNextInstances([marketInstance, tokenInstance]);

      const res = await service.getMarketV2UnderlyingToken('0xMarket', 'mainnet');
      expect(marketInstance.underlying).toHaveBeenCalled();
      expect(tokenInstance.symbol).toHaveBeenCalled();
      expect(res.symbol).toBe('MKR');
      expect(res.decimals).toBe(18);
    });
  });

  describe('getRewardsCompToken', () => {
    it('should call rewardConfig and return token address', async () => {
      const mockProvider: any = {};
      const rewardsInstance = {
        rewardConfig: jest.fn().mockResolvedValue(['0xComp', 0, 0, 0]),
      };
      (ethers as any).Contract.__setNextInstances([rewardsInstance]);

      const token = await service.getRewardsCompToken('0xRewards', '0xComet', 'base', mockProvider);
      expect(rewardsInstance.rewardConfig).toHaveBeenCalledWith('0xComet');
      expect(token).toBe('0xComp');
    });
  });

  describe('computeMarketAccounting default branch', () => {
    it('uses provider.getBalance for ETH/MNT assets', async () => {
      const mockProvider: any = { getBalance: jest.fn().mockResolvedValue(1000n) };
      const params: any = {
        algorithm: 'OTHER',
        contract: {},
        blockTag: 123,
        decimals: 18,
        provider: mockProvider,
        contractAddress: '0xVault',
        network: 'base',
        asset: { symbol: 'ETH', decimals: 18 },
        assetContract: {},
      };
      const res = await (service as any).computeMarketAccounting(params);
      expect(mockProvider.getBalance).toHaveBeenCalledWith('0xVault', 123);
      expect(res.reserves).toBe(0.000000000000001); // 1000n / 10^18
      expect(res.incomes.supply).toBe(0);
      expect(res.incomes.borrow).toBe(0);
      expect(res.spends.supplyUsd).toBe(0);
      expect(res.spends.borrowUsd).toBe(0);
    });

    it('uses ERC20.balanceOf for non-native assets', async () => {
      const assetContract = { balanceOf: jest.fn().mockResolvedValue(2000n) } as any;
      const params: any = {
        algorithm: 'OTHER',
        contract: {},
        blockTag: 456,
        decimals: 6,
        provider: { getBalance: jest.fn() },
        contractAddress: '0xVault',
        network: 'base',
        asset: { symbol: 'USDC', decimals: 6 },
        assetContract,
      };
      const res = await (service as any).computeMarketAccounting(params);
      expect(assetContract.balanceOf).toHaveBeenCalledWith('0xVault', { blockTag: 456 });
      expect(res.reserves).toBe(0.002); // 2000n / 10^6
    });
  });

  describe('findBlockByTimestamp', () => {
    it('estimates from cached reference and returns estimated when within slip', async () => {
      const mockProvider: any = { getBlockNumber: jest.fn().mockResolvedValue(200) };
      (providerFactoryMock.get as any) = jest.fn().mockReturnValue(mockProvider);

      const getCachedBlockSpy = jest
        .spyOn<any, any>(service as any, 'getCachedBlock')
        .mockImplementation(async (...args: unknown[]) => {
          const blockNumber = args[2] as number;
          if (blockNumber === 100) return { blockNumber: 100, timestamp: 1000, hash: '0x' };
          if (blockNumber === 160) return { blockNumber: 160, timestamp: 1120, hash: '0x' };
          return { blockNumber, timestamp: 1000, hash: '0x' };
        });

      const result = await (service as any).findBlockByTimestamp('base', mockProvider, 1120, 100);
      expect(result).toBe(160);
      expect(getCachedBlockSpy).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    const baseSource: any = {
      id: 1,
      address: '0xComet',
      network: 'base',
      algorithm: 'OTHER',
      asset: { address: '0xToken', symbol: 'USDC', decimals: 6 },
      blockNumber: 100,
    };

    it('skips when no daily timestamps and updates source', async () => {
      const mockProvider: any = {};
      (providerFactoryMock.get as any) = jest.fn().mockReturnValue(mockProvider);

      jest.spyOn<any, any>(service as any, 'getCachedBlock').mockResolvedValue({
        blockNumber: 100,
        timestamp: 1_700_000_000,
        hash: '0x',
      });
      jest.spyOn<any, any>(service as any, 'buildDailyTimestamps').mockReturnValue([]);

      await service.getHistory(baseSource);

      expect(sourceServiceMock.updateWithSource).toHaveBeenCalled();
      const callArg = (sourceServiceMock.updateWithSource as any).mock.calls[0][0];
      expect(callArg.source).toBe(baseSource);
      expect(callArg.blockNumber).toBe(100);
    });

    it('processes timestamps and respects early stop outcome', async () => {
      const mockProvider: any = {};
      (providerFactoryMock.get as any) = jest.fn().mockReturnValue(mockProvider);

      jest.spyOn<any, any>(service as any, 'getCachedBlock').mockResolvedValue({
        blockNumber: 100,
        timestamp: 1_700_000_000,
        hash: '0x',
      });
      jest
        .spyOn<any, any>(service as any, 'buildDailyTimestamps')
        .mockReturnValue([1_700_000_000, 1_700_086_400]);
      jest.spyOn<any, any>(service as any, 'preloadPrices').mockResolvedValue(undefined);

      const processSpy = jest
        .spyOn<any, any>(service as any, 'processOneDay')
        .mockResolvedValueOnce({ lastBlock: 110, processedDelta: 0, skippedDelta: 0, stop: true });

      await service.getHistory(baseSource);

      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(sourceServiceMock.updateWithSource).not.toHaveBeenCalled();
    });

    it('handles thrown error and notifies via mail', async () => {
      (providerFactoryMock.get as any) = jest.fn(() => {
        throw new Error('provider error');
      });

      await service.getHistory(baseSource);

      expect(mailServiceMock.notifyGetHistoryError).toHaveBeenCalled();
    });
  });
});
