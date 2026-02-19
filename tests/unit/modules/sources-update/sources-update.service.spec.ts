import axios from 'axios';
import { QueryFailedError } from 'typeorm';

import { Algorithm } from '@/common/enum/algorithm.enum';
import { AssetEntity } from '@/modules/asset/asset.entity';
import { SourceEntity } from '@/modules/source/source.entity';
import { SourcesUpdateService } from '@/modules/sources-update/sources-update.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe('SourcesUpdateService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  const makeAsset = (params: {
    id: number;
    address: string;
    symbol: string;
    network?: string;
    decimals?: number;
    type?: string;
  }): AssetEntity => {
    const asset = new AssetEntity(
      params.address,
      params.decimals ?? 18,
      params.symbol,
      params.network ?? 'eth',
      params.type ?? 'erc20',
    );
    asset.id = params.id;
    return asset;
  };

  const makeSource = (params: {
    id: number;
    address: string;
    asset: AssetEntity;
    algorithm: string[];
    startBlock?: number;
    endBlock?: number;
    network?: string;
    type?: string;
    market?: string;
  }): SourceEntity => {
    const source = new SourceEntity(
      params.address,
      params.network ?? 'eth',
      params.algorithm,
      params.type ?? 'treasury',
      params.startBlock ?? 1,
      params.asset,
      params.market,
      params.endBlock,
    );
    source.id = params.id;
    return source;
  };

  const makeDeps = () => {
    const config = {
      repoUrl: 'https://repo.example',
      rawAssetsUrl: 'https://repo.example/assets.json',
      rawSourcesUrl: 'https://repo.example/sources.json',
      requestTimeoutMs: 5000,
    };

    const configService = {
      get: jest.fn().mockReturnValue(config),
    };

    const networkService = {
      byChainId: jest.fn((chainId: number) => {
        if (chainId === 1) return { network: 'eth' };
        return null;
      }),
    };

    const syncRepo = {
      inTransaction: jest.fn(),
      listAllAssets: jest.fn(),
      listAllSources: jest.fn(),
      saveAssets: jest.fn(),
      saveSources: jest.fn(),
      deleteSourcesByIds: jest.fn(),
      deleteAssetsByIds: jest.fn(),
    };

    const validationService = {
      validateAll: jest.fn(),
    };

    const service = new SourcesUpdateService(
      configService as never,
      networkService as never,
      syncRepo as never,
      validationService as never,
    );

    return { service, configService, networkService, syncRepo, validationService, config };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts and deletes stale sources/assets in one run', async () => {
    const { service, syncRepo, validationService, config } = makeDeps();

    const httpGet = jest.fn(async (url: string) => {
      if (url === config.rawAssetsUrl) return { data: { raw: 'assets' } };
      if (url === config.rawSourcesUrl) return { data: { raw: 'sources' } };
      throw new Error('unexpected url');
    });
    mockedAxios.create.mockReturnValue({ get: httpGet } as never);

    const dbAssetKeep = makeAsset({
      id: 1,
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'OLD',
    });
    const dbAssetStale = makeAsset({
      id: 102,
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'STALE',
    });

    const dbSourceKeep = makeSource({
      id: 10,
      address: '0x0000000000000000000000000000000000000010',
      asset: dbAssetKeep,
      algorithm: [Algorithm.COMET, Algorithm.COMET_STATS],
      startBlock: 5,
      market: 'old-market',
    });
    const dbSourceStale = makeSource({
      id: 202,
      address: '0x0000000000000000000000000000000000000020',
      asset: dbAssetStale,
      algorithm: [Algorithm.REWARDS],
      startBlock: 10,
    });

    validationService.validateAll.mockResolvedValue({
      assets: [
        {
          id: 1,
          address: dbAssetKeep.address,
          decimals: 18,
          symbol: 'USDC',
          chainId: 1,
          type: 'erc20',
        },
        {
          id: 3,
          address: '0x0000000000000000000000000000000000000003',
          decimals: 8,
          symbol: 'NEW',
          chainId: 1,
          type: 'erc20',
        },
      ],
      sources: [
        {
          id: 10,
          address: dbSourceKeep.address,
          market: null,
          algorithm: [Algorithm.COMET_STATS, Algorithm.COMET],
          startBlock: 12,
          endBlock: null,
          chainId: 1,
          assetId: 1,
          type: 'treasury',
        },
        {
          id: 11,
          address: '0x0000000000000000000000000000000000000030',
          market: null,
          algorithm: [Algorithm.REWARDS],
          startBlock: 15,
          endBlock: null,
          chainId: 1,
          assetId: 3,
          type: 'treasury',
        },
      ],
    });

    syncRepo.inTransaction.mockImplementation(async (work: (manager: unknown) => Promise<void>) => {
      await work({});
    });
    syncRepo.listAllAssets.mockResolvedValue([dbAssetKeep, dbAssetStale]);
    syncRepo.listAllSources.mockResolvedValue([dbSourceKeep, dbSourceStale]);

    const insertedAsset = makeAsset({
      id: 3,
      address: '0x0000000000000000000000000000000000000003',
      symbol: 'NEW',
      decimals: 8,
    });

    syncRepo.saveAssets.mockResolvedValueOnce([insertedAsset]).mockResolvedValueOnce([dbAssetKeep]);
    syncRepo.saveSources.mockResolvedValue([]);
    syncRepo.deleteSourcesByIds.mockResolvedValue(undefined);
    syncRepo.deleteAssetsByIds.mockResolvedValue(undefined);

    await service.run();

    expect(validationService.validateAll).toHaveBeenCalledWith({
      assetsRaw: { raw: 'assets' },
      sourcesRaw: { raw: 'sources' },
    });

    expect(syncRepo.saveAssets).toHaveBeenCalledTimes(2);
    expect(syncRepo.saveSources).toHaveBeenCalledTimes(2);
    expect(syncRepo.deleteSourcesByIds).toHaveBeenCalledWith([202], expect.anything());
    expect(syncRepo.deleteAssetsByIds).toHaveBeenCalledWith([102], expect.anything());

    const insertedSources = syncRepo.saveSources.mock.calls[0][0] as SourceEntity[];
    expect(insertedSources).toHaveLength(1);
    expect(insertedSources[0].id).toBe(11);
    expect(insertedSources[0].asset.id).toBe(3);

    const updatedSources = syncRepo.saveSources.mock.calls[1][0] as SourceEntity[];
    expect(updatedSources[0].id).toBe(10);
    expect(updatedSources[0].startBlock).toBe(12);
    expect(updatedSources[0].algorithm).toEqual([Algorithm.COMET_STATS, Algorithm.COMET]);

    const deleteSourcesOrder = syncRepo.deleteSourcesByIds.mock.invocationCallOrder[0];
    const deleteAssetsOrder = syncRepo.deleteAssetsByIds.mock.invocationCallOrder[0];
    expect(deleteSourcesOrder).toBeLessThan(deleteAssetsOrder);
  });

  it('does not start transaction or delete when validation fails', async () => {
    const { service, syncRepo, validationService, config } = makeDeps();

    mockedAxios.create.mockReturnValue({
      get: jest.fn(async (url: string) => {
        if (url === config.rawAssetsUrl) return { data: [] };
        if (url === config.rawSourcesUrl) return { data: [] };
        throw new Error('unexpected url');
      }),
    } as never);

    validationService.validateAll.mockRejectedValue(new Error('validation failed'));

    await expect(service.run()).rejects.toThrow('validation failed');

    expect(syncRepo.inTransaction).not.toHaveBeenCalled();
    expect(syncRepo.deleteSourcesByIds).not.toHaveBeenCalled();
    expect(syncRepo.deleteAssetsByIds).not.toHaveBeenCalled();
  });

  it('propagates transaction failure and does not perform later deletions', async () => {
    const { service, syncRepo, validationService, config } = makeDeps();

    mockedAxios.create.mockReturnValue({
      get: jest.fn(async (url: string) => {
        if (url === config.rawAssetsUrl) return { data: [] };
        if (url === config.rawSourcesUrl) return { data: [] };
        throw new Error('unexpected url');
      }),
    } as never);

    const dbAsset = makeAsset({
      id: 1,
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'USDC',
    });

    validationService.validateAll.mockResolvedValue({
      assets: [
        {
          id: 1,
          address: dbAsset.address,
          decimals: 18,
          symbol: 'USDC',
          chainId: 1,
          type: 'erc20',
        },
      ],
      sources: [
        {
          id: 10,
          address: '0x0000000000000000000000000000000000000010',
          market: null,
          algorithm: [Algorithm.COMET],
          startBlock: 12,
          endBlock: null,
          chainId: 1,
          assetId: 1,
          type: 'treasury',
        },
      ],
    });

    syncRepo.inTransaction.mockImplementation(async (work: (manager: unknown) => Promise<void>) => {
      await work({});
    });
    syncRepo.listAllAssets.mockResolvedValue([dbAsset]);
    syncRepo.listAllSources.mockResolvedValue([]);
    syncRepo.saveAssets.mockResolvedValue([]);

    const txError = new Error('saveSources failed');
    syncRepo.saveSources.mockRejectedValue(txError);

    await expect(service.run()).rejects.toThrow('saveSources failed');

    expect(syncRepo.deleteSourcesByIds).not.toHaveBeenCalled();
    expect(syncRepo.deleteAssetsByIds).not.toHaveBeenCalled();
  });

  it('fails fast when reserveSources config is missing', async () => {
    const { service, configService } = makeDeps();
    configService.get.mockReturnValue(undefined);

    await expect(service.run()).rejects.toThrow('reserveSources config is missing');
  });

  it('fails fast on invalid remote records and does not delete stale db rows', async () => {
    const { service, syncRepo, validationService, config } = makeDeps();

    mockedAxios.create.mockReturnValue({
      get: jest.fn(async (url: string) => {
        if (url === config.rawAssetsUrl) return { data: [] };
        if (url === config.rawSourcesUrl) return { data: [] };
        throw new Error('unexpected url');
      }),
    } as never);

    const dbAssetStale = makeAsset({
      id: 102,
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'STALE',
    });
    const dbSourceStale = makeSource({
      id: 202,
      address: '0x0000000000000000000000000000000000000020',
      asset: dbAssetStale,
      algorithm: [Algorithm.REWARDS],
      startBlock: 10,
    });

    validationService.validateAll.mockResolvedValue({
      assets: [
        {
          id: 1,
          address: '0x0000000000000000000000000000000000000001',
          decimals: 18,
          symbol: 'USDC',
          chainId: 999, // unknown chain -> skipped in prepareAssetSyncPlan
          type: 'erc20',
        },
        {
          id: 2,
          address: '0x0000000000000000000000000000000000000004',
          decimals: 18,
          symbol: 'OK',
          chainId: 1,
          type: 'erc20',
        },
      ],
      sources: [
        {
          id: 10,
          address: '0x0000000000000000000000000000000000000010',
          market: null,
          algorithm: [Algorithm.COMET],
          startBlock: 12,
          endBlock: null,
          chainId: 1,
          assetId: 9999, // missing asset
          type: 'treasury',
        },
        {
          id: 11,
          address: '0x0000000000000000000000000000000000000011',
          market: null,
          algorithm: [Algorithm.COMET],
          startBlock: 13,
          endBlock: null,
          chainId: 999, // unknown network
          assetId: 2,
          type: 'treasury',
        },
        {
          id: 12,
          address: '0x0000000000000000000000000000000000000012',
          market: null,
          algorithm: [Algorithm.COMET],
          startBlock: 14,
          endBlock: null,
          chainId: 1,
          assetId: 2,
          type: null as unknown as string, // missing type
        },
      ],
    });

    syncRepo.inTransaction.mockImplementation(async (work: (manager: unknown) => Promise<void>) => {
      await work({});
    });
    syncRepo.listAllAssets.mockResolvedValue([dbAssetStale]);
    syncRepo.listAllSources.mockResolvedValue([dbSourceStale]);
    syncRepo.saveAssets.mockResolvedValue([]);
    syncRepo.saveSources.mockResolvedValue([]);
    syncRepo.deleteSourcesByIds.mockResolvedValue(undefined);
    syncRepo.deleteAssetsByIds.mockResolvedValue(undefined);

    await expect(service.run()).rejects.toThrow(
      'Sources update aborted: 1 asset validation error(s). No changes applied. Asset id=1: unknown chainId 999',
    );

    expect(syncRepo.saveAssets).not.toHaveBeenCalled();
    expect(syncRepo.saveSources).not.toHaveBeenCalled();
    expect(syncRepo.deleteSourcesByIds).not.toHaveBeenCalled();
    expect(syncRepo.deleteAssetsByIds).not.toHaveBeenCalled();
  });

  it('applyRemoteToAsset updates all mutable asset fields and reports change', () => {
    const { service } = makeDeps();
    const asset = makeAsset({
      id: 10,
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'OLD',
      network: 'polygon',
      decimals: 6,
      type: 'legacy',
    });

    const changed = (
      service as unknown as { applyRemoteToAsset: (a: AssetEntity, r: unknown) => boolean }
    ).applyRemoteToAsset(asset, {
      chainId: 1,
      decimals: 18,
      symbol: 'USDC',
      type: 'erc20',
    });

    expect(changed).toBe(true);
    expect(asset.network).toBe('eth');
    expect(asset.decimals).toBe(18);
    expect(asset.symbol).toBe('USDC');
    expect(asset.type).toBe('erc20');
  });

  it('applyRemoteToSource updates mutable source fields and reports change', () => {
    const { service } = makeDeps();
    const oldAsset = makeAsset({
      id: 11,
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'OLD',
    });
    const newAsset = makeAsset({
      id: 12,
      address: '0x0000000000000000000000000000000000000003',
      symbol: 'NEW',
    });

    const source = makeSource({
      id: 30,
      address: '0x00000000000000000000000000000000000000aa',
      asset: oldAsset,
      algorithm: [Algorithm.COMET],
      startBlock: 1,
      network: 'polygon',
      type: 'legacy',
      market: 'legacy-market',
    });

    const changed = (
      service as unknown as {
        applyRemoteToSource: (s: SourceEntity, r: unknown, a: AssetEntity) => boolean;
      }
    ).applyRemoteToSource(
      source,
      {
        chainId: 1,
        startBlock: 99,
        endBlock: null,
        market: null,
        algorithm: [Algorithm.REWARDS],
        type: 'treasury',
      },
      newAsset,
    );

    expect(changed).toBe(true);
    expect(source.network).toBe('eth');
    expect(source.asset.id).toBe(newAsset.id);
    expect(source.startBlock).toBe(99);
    expect(source.market).toBeUndefined();
    expect(source.algorithm).toEqual([Algorithm.REWARDS]);
    expect(source.type).toBe('treasury');
  });

  it('logs query details on QueryFailedError and rethrows', async () => {
    const { service, syncRepo, validationService, config } = makeDeps();

    mockedAxios.create.mockReturnValue({
      get: jest.fn(async (url: string) => {
        if (url === config.rawAssetsUrl) return { data: [] };
        if (url === config.rawSourcesUrl) return { data: [] };
        throw new Error('unexpected url');
      }),
    } as never);

    validationService.validateAll.mockResolvedValue({ assets: [], sources: [] });

    const queryErr = new QueryFailedError('INSERT', ['0xabc', 18, 'USDC', 'eth'], new Error('db'));

    syncRepo.inTransaction.mockRejectedValue(queryErr);

    await expect(service.run()).rejects.toBe(queryErr);
  });
});
