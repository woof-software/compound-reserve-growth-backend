import { DataSource } from 'typeorm';

import { AssetEntity } from '@/modules/asset/asset.entity';
import { SourceEntity } from '@/modules/source/source.entity';
import { SyncRepository } from '@/modules/sources-update/repositories/sync.repository';

describe('SyncRepository', () => {
  const makeQueryRunner = () => ({
    manager: {},
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  });

  it('commits transaction on success', async () => {
    const queryRunner = makeQueryRunner();
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);
    const result = await repo.inTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(queryRunner.startTransaction).toHaveBeenCalledWith('READ COMMITTED');
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back transaction on work error', async () => {
    const queryRunner = makeQueryRunner();
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);

    await expect(
      repo.inTransaction(async () => {
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('attaches rollback error as cause when rollback fails', async () => {
    const queryRunner = makeQueryRunner();
    queryRunner.rollbackTransaction.mockRejectedValue(new Error('rollback failed'));

    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);

    try {
      await repo.inTransaction(async () => {
        throw new Error('work failed');
      });
    } catch (error) {
      const err = error as Error & { cause?: unknown };
      expect(err.message).toBe('work failed');
      expect((err.cause as Error).message).toBe('rollback failed');
    }

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('delegates list/save/delete helpers to manager repositories', async () => {
    const assetRepo = {
      find: jest.fn().mockResolvedValue(['a1']),
      save: jest.fn().mockResolvedValue(['a2']),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const sourceRepo = {
      find: jest.fn().mockResolvedValue(['s1']),
      save: jest.fn().mockResolvedValue(['s2']),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === AssetEntity) return assetRepo;
        if (entity === SourceEntity) return sourceRepo;
        throw new Error('unknown entity');
      }),
    };

    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);

    await expect(repo.listAllAssets(manager as never)).resolves.toEqual(['a1']);
    await expect(repo.saveAssets([] as never, manager as never)).resolves.toEqual(['a2']);
    await expect(repo.listAllSources(manager as never)).resolves.toEqual(['s1']);
    await expect(repo.saveSources([] as never, manager as never)).resolves.toEqual(['s2']);
    await expect(repo.deleteSourcesByIds([1], manager as never)).resolves.toBeUndefined();
    await expect(repo.deleteAssetsByIds([2], manager as never)).resolves.toBeUndefined();

    expect(assetRepo.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    expect(sourceRepo.find).toHaveBeenCalledWith({
      relations: { asset: true },
      order: { id: 'ASC' },
    });
    expect(sourceRepo.delete).toHaveBeenCalledWith([1]);
    expect(assetRepo.delete).toHaveBeenCalledWith([2]);
  });

  it('skips delete calls when ids list is empty', async () => {
    const assetRepo = { delete: jest.fn() };
    const sourceRepo = { delete: jest.fn() };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === AssetEntity) return assetRepo;
        if (entity === SourceEntity) return sourceRepo;
        throw new Error('unknown entity');
      }),
    };

    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);

    await repo.deleteSourcesByIds([], manager as never);
    await repo.deleteAssetsByIds([], manager as never);

    expect(sourceRepo.delete).not.toHaveBeenCalled();
    expect(assetRepo.delete).not.toHaveBeenCalled();
  });
});
