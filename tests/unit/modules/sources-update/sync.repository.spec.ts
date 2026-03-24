import { DataSource } from 'typeorm';

import { AssetEntity } from '@/modules/asset/asset.entity';
import { SourceEntity } from '@/modules/source/source.entity';
import { ReserveEntity, IncomesEntity, SpendsEntity } from '@/modules/history/entities';
import { TreasuryEntity } from '@/modules/treasury/treasury.entity';
import { RevenueEntity } from '@/modules/revenue/revenue.entity';
import { SyncRepository } from '@/modules/sources-update/repositories/sync.repository';

/** Mock repository for delete by sourceId (createQueryBuilder().delete().where().execute()). */
const makeDeleteBySourceIdsRepo = () => {
  const execute = jest.fn().mockResolvedValue({ affected: 0 });
  return {
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ execute }),
      }),
    }),
  };
};

/** Mock for soft delete (createQueryBuilder().update().set().where().andWhere().execute()). */
const makeSoftDeleteRepo = () => {
  const execute = jest.fn().mockResolvedValue({ affected: 0 });
  return {
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({ execute }),
          }),
        }),
      }),
    }),
  };
};

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
    const assetRepo = makeSoftDeleteRepo();
    assetRepo.find.mockResolvedValue(['a1']);
    assetRepo.save.mockResolvedValue(['a2']);

    const sourceRepo = makeSoftDeleteRepo();
    sourceRepo.find.mockResolvedValue(['s1']);
    sourceRepo.save.mockResolvedValue(['s2']);

    const dependentRepo = makeDeleteBySourceIdsRepo();

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === AssetEntity) return assetRepo;
        if (entity === SourceEntity) return sourceRepo;
        if (
          entity === ReserveEntity ||
          entity === IncomesEntity ||
          entity === SpendsEntity ||
          entity === TreasuryEntity ||
          entity === RevenueEntity
        ) {
          return dependentRepo;
        }
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

    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { deletedAt: null },
      order: { id: 'ASC' },
    });
    expect(sourceRepo.find).toHaveBeenCalledWith({
      where: { deletedAt: null },
      relations: { asset: true },
      order: { id: 'ASC' },
    });
    expect(sourceRepo.createQueryBuilder).toHaveBeenCalled();
    expect(assetRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('skips delete calls when ids list is empty', async () => {
    const assetRepo = makeSoftDeleteRepo();
    const sourceRepo = makeSoftDeleteRepo();
    const dependentRepo = makeDeleteBySourceIdsRepo();

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === AssetEntity) return assetRepo;
        if (entity === SourceEntity) return sourceRepo;
        if (
          entity === ReserveEntity ||
          entity === IncomesEntity ||
          entity === SpendsEntity ||
          entity === TreasuryEntity ||
          entity === RevenueEntity
        ) {
          return dependentRepo;
        }
        throw new Error('unknown entity');
      }),
    };

    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    const repo = new SyncRepository(dataSource);

    await repo.deleteSourcesByIds([], manager as never);
    await repo.deleteAssetsByIds([], manager as never);

    expect(sourceRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(assetRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
