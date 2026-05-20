import { Price } from '@/modules/price/price.entity';
import { PriceService } from '@/modules/price/price.service';

describe('PriceService', () => {
  const makeService = () => {
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const redisClient = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      ping: jest.fn().mockResolvedValue('PONG'),
      pipeline: jest.fn(),
      scanStream: jest.fn(),
      del: jest.fn(),
    };
    const collateralPriceService = {
      getPrice: jest.fn(),
    };
    const coinGeckoProvider = {
      getProviderName: jest.fn().mockReturnValue('coingecko'),
      getMappings: jest.fn().mockReturnValue({}),
      getHistoricalPrice: jest.fn(),
      preloadPrices: jest.fn(),
    };
    const priceRepository = {
      findBySymbolAndDate: jest.fn(),
      saveToDatabase: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PriceService(
      cacheManager as never,
      redisClient as never,
      collateralPriceService as never,
      coinGeckoProvider as never,
      priceRepository as never,
    );

    return {
      collateralPriceService,
      priceRepository,
      redisClient,
      service,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns collateral prices from the database and skips on-chain resolution', async () => {
    const { collateralPriceService, priceRepository, redisClient, service } = makeService();
    const date = new Date('2024-10-01T15:30:00.000Z');
    const storedPrice = new Price('cbBTC', 110_000.55, new Date('2024-10-01T00:00:00.000Z'));

    priceRepository.findBySymbolAndDate.mockResolvedValue(storedPrice);

    const result = await service.getCollateralHistoricalPrice(
      {
        address: '0xasset',
        symbol: 'cbBTC',
        decimals: 8,
      },
      {
        blockTag: 1_234,
        cometAddress: '0xcomet',
        date,
        network: 'mainnet',
      },
    );

    expect(priceRepository.findBySymbolAndDate).toHaveBeenCalledWith(
      'cbBTC',
      new Date('2024-10-01T00:00:00.000Z'),
      undefined,
    );
    expect(collateralPriceService.getPrice).not.toHaveBeenCalled();
    expect(redisClient.setex).toHaveBeenCalledWith(
      'price:cbBTC:2024-10-01',
      expect.any(Number),
      expect.stringContaining('"source":"database"'),
    );
    expect(result).toBe(110_000.55);
  });

  it('reads collateral prices on-chain, stores them, and caches the result when DB is missing', async () => {
    const { collateralPriceService, priceRepository, redisClient, service } = makeService();
    const date = new Date('2024-10-01T15:30:00.000Z');

    priceRepository.findBySymbolAndDate.mockResolvedValue(null);
    collateralPriceService.getPrice.mockResolvedValue(116_103.22);

    const result = await service.getCollateralHistoricalPrice(
      {
        address: '0xasset',
        symbol: 'cbBTC',
        decimals: 8,
      },
      {
        blockTag: 1_234,
        cometAddress: '0xcomet',
        date,
        network: 'mainnet',
      },
    );

    expect(collateralPriceService.getPrice).toHaveBeenCalledWith({
      assetAddress: '0xasset',
      assetSymbol: 'cbBTC',
      blockTag: 1_234,
      cometAddress: '0xcomet',
      date,
      network: 'mainnet',
    });
    expect(priceRepository.saveToDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'cbBTC',
        price: 116_103.22,
        date: new Date('2024-10-01T00:00:00.000Z'),
      }),
      undefined,
    );
    expect(redisClient.setex).toHaveBeenCalledWith(
      'price:cbBTC:2024-10-01',
      expect.any(Number),
      expect.stringContaining('"source":"collateral_feed"'),
    );
    expect(result).toBe(116_103.22);
  });

  it('propagates on-chain collateral failures without writing DB or cache entries', async () => {
    const { collateralPriceService, priceRepository, redisClient, service } = makeService();

    priceRepository.findBySymbolAndDate.mockResolvedValue(null);
    collateralPriceService.getPrice.mockRejectedValue(new Error('oracle reverted'));

    await expect(
      service.getCollateralHistoricalPrice(
        {
          address: '0xasset',
          symbol: 'cbBTC',
          decimals: 8,
        },
        {
          blockTag: 1,
          cometAddress: '0xcomet',
          date: new Date('2024-10-01T00:00:00.000Z'),
          network: 'mainnet',
        },
      ),
    ).rejects.toThrow('oracle reverted');

    expect(priceRepository.saveToDatabase).not.toHaveBeenCalled();
    expect(redisClient.setex).not.toHaveBeenCalled();
  });
});
