import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { EntityManager } from 'typeorm';

import { RevenueEntity } from './revenue.entity';
import { RevenueSyncRepository } from './revenue-sync.repository';
import { RevenueRepository } from './revenue.repository';
import { buildRevenueProjectionRows } from './builders/build-revenue-projection-rows';

import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);

  constructor(
    private readonly revenueRepository: RevenueRepository,
    private readonly revenueSyncRepository: RevenueSyncRepository,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async rebuildHistory(clearData = false, manager?: EntityManager): Promise<void> {
    let rebuiltSourceCount = 0;
    const usesExternalTransaction = Boolean(manager);

    const rebuildWithManager = async (entityManager: EntityManager) => {
      const sourceIds = await this.revenueSyncRepository.listSupportedSourceIds(entityManager);
      rebuiltSourceCount = sourceIds.length;
      const staleDeletedCount = await this.revenueSyncRepository.deleteOutsideScope(
        sourceIds,
        entityManager,
      );

      if (sourceIds.length === 0) {
        return { deletedCount: staleDeletedCount, insertedCount: 0 };
      }

      const checkpoints = clearData
        ? []
        : await this.revenueSyncRepository.listSourceCheckpoints(sourceIds, entityManager);
      const reserveSnapshots = await this.revenueSyncRepository.listProjectionReserveSnapshots(
        sourceIds,
        checkpoints,
        entityManager,
      );
      const scopeDeletedCount = clearData
        ? await this.revenueSyncRepository.deleteBySourceIds(sourceIds, entityManager)
        : await this.revenueSyncRepository.deleteFromCheckpoints(checkpoints, entityManager);
      const projectionRows = buildRevenueProjectionRows(reserveSnapshots);
      const insertedCount = await this.revenueSyncRepository.insertRows(
        projectionRows,
        entityManager,
      );

      return {
        deletedCount: staleDeletedCount + scopeDeletedCount,
        insertedCount,
      };
    };

    const { deletedCount, insertedCount } = manager
      ? await rebuildWithManager(manager)
      : await this.revenueSyncRepository.inTransaction(rebuildWithManager);
    const invalidatedCacheKeys =
      !usesExternalTransaction && (deletedCount > 0 || insertedCount > 0)
        ? await this.clearHistoryCache()
        : 0;

    this.logger.log(
      `Revenue history sync completed sourceCount=${rebuiltSourceCount} deletedRows=${deletedCount} insertedRows=${insertedCount} invalidatedCacheKeys=${invalidatedCacheKeys}`,
    );
  }

  async getHistory(): Promise<RevenueEntity[]> {
    const revenueHistory = await this.revenueRepository.listAll();
    if (!revenueHistory.length) {
      throw new NotFoundException('No revenue history found');
    }

    return revenueHistory;
  }

  async getPaginatedHistory(dto: PaginationDto): Promise<PaginatedDataDto<RevenueEntity>> {
    return this.revenueRepository.getPaginatedHistory(dto);
  }

  async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<RevenueEntity>> {
    return this.revenueRepository.getOffsetHistory(dto);
  }

  private async clearHistoryCache(): Promise<number> {
    const stream = this.redisClient.scanStream({
      match: 'history:v2:revenue:*',
      count: 100,
    });

    const keysToDelete: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys);
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (!keysToDelete.length) {
      return 0;
    }

    return this.redisClient.del(...keysToDelete);
  }
}
