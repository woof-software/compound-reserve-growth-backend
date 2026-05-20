import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { EntityManager } from 'typeorm';

import { IncentivesSyncRepository } from './incentives-sync.repository';
import {
  buildIncentiveProjectionRows,
  normalizeIncentivePriceComp,
} from './builders/build-incentive-projection-rows';

import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

@Injectable()
export class IncentivesService {
  private readonly logger = new Logger(IncentivesService.name);

  constructor(
    private readonly incentivesSyncRepository: IncentivesSyncRepository,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  public async rebuildHistory(manager?: EntityManager): Promise<void> {
    let rebuiltSourceCount = 0;
    const usesExternalTransaction = Boolean(manager);

    const rebuildWithManager = async (entityManager: EntityManager) => {
      const sourceIds = await this.incentivesSyncRepository.listSupportedSourceIds(entityManager);
      rebuiltSourceCount = sourceIds.length;
      const staleDeletedCount = await this.incentivesSyncRepository.deleteOutsideScope(
        sourceIds,
        entityManager,
      );

      if (sourceIds.length === 0) {
        return { deletedCount: staleDeletedCount, insertedCount: 0 };
      }

      const [reserveSnapshots, spendSnapshots] = await Promise.all([
        this.incentivesSyncRepository.listDailyReserveSnapshots(sourceIds, entityManager),
        this.incentivesSyncRepository.listLatestSpends(sourceIds, entityManager),
      ]);
      const projectionDays = [
        ...new Set([...reserveSnapshots, ...spendSnapshots].map((row) => row.day)),
      ];
      const compPrices = await this.incentivesSyncRepository.listLatestCompPrices(
        projectionDays,
        entityManager,
      );
      const rawProjectionRows = buildIncentiveProjectionRows(
        reserveSnapshots,
        spendSnapshots,
        compPrices,
      );
      this.logMissingPriceComp(rawProjectionRows);
      const projectionRows = normalizeIncentivePriceComp(rawProjectionRows);
      const scopeDeletedCount = await this.incentivesSyncRepository.deleteBySourceIds(
        sourceIds,
        entityManager,
      );
      const insertedCount = await this.incentivesSyncRepository.insertRows(
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
      : await this.incentivesSyncRepository.inTransaction(rebuildWithManager);
    const invalidatedCacheKeys =
      !usesExternalTransaction && (deletedCount > 0 || insertedCount > 0)
        ? await this.clearHistoryCache()
        : 0;

    this.logger.log(
      `Incentives history rebuild completed sourceCount=${rebuiltSourceCount} deletedRows=${deletedCount} insertedRows=${insertedCount} invalidatedCacheKeys=${invalidatedCacheKeys}`,
    );
  }

  private logMissingPriceComp(rows: ReturnType<typeof buildIncentiveProjectionRows>): void {
    for (const row of rows) {
      if (!row.priceComp) {
        this.logger.warn(
          `Incentives priceComp not found for sourceId=${row.sourceId} date=${row.date.toISOString()}`,
        );
      }
    }
  }

  private async clearHistoryCache(): Promise<number> {
    const stream = this.redisClient.scanStream({
      match: 'history:v2:incentives:*',
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
