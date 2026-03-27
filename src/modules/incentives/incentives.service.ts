import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { IncentivesRepository } from './incentives.repository';
import { IncentiveProjectionRow } from './types/incentive-projection-row.type';

import { REDIS_CLIENT } from 'infrastructure/redis/redis.module';

@Injectable()
export class IncentivesService {
  private readonly logger = new Logger(IncentivesService.name);

  constructor(
    private readonly incentivesRepository: IncentivesRepository,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  public async rebuildHistory(): Promise<void> {
    const rebuiltCount = await this.incentivesRepository.inTransaction(async (manager) => {
      const projectionRows = await this.incentivesRepository.buildProjectionRows(manager);
      const normalizedRows = this.fillMissingPriceComp(projectionRows);

      return this.incentivesRepository.replaceAll(normalizedRows, manager);
    });

    const invalidatedCacheKeys = await this.clearHistoryCache();

    this.logger.log(
      `Incentives history rebuild completed rows=${rebuiltCount} invalidatedCacheKeys=${invalidatedCacheKeys}`,
    );
  }

  private fillMissingPriceComp(rows: IncentiveProjectionRow[]): IncentiveProjectionRow[] {
    const missingLeadingIndexes: number[] = [];
    let firstPrice = 0;
    let previousPrice = 0;

    const normalizedRows = rows.map((row, index) => {
      const normalizedRow = { ...row };

      if (!normalizedRow.priceComp) {
        this.logger.warn(`Incentives priceComp not found for ${normalizedRow.date.toISOString()}`);
        if (previousPrice) {
          normalizedRow.priceComp = previousPrice;
        } else {
          missingLeadingIndexes.push(index);
        }
      } else {
        firstPrice = firstPrice || normalizedRow.priceComp;
        previousPrice = normalizedRow.priceComp;
      }

      return normalizedRow;
    });

    if (firstPrice) {
      missingLeadingIndexes.forEach((index) => {
        normalizedRows[index].priceComp = firstPrice;
      });
    }

    return normalizedRows;
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
