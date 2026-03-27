import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

import { OffsetDto } from 'modules/history/dto/offset.dto';
import { PaginationDto } from 'modules/history/dto/pagination.dto';

import { RevenueEntity } from './revenue.entity';
import { RevenueRepository } from './revenue.repository';

import { REDIS_CLIENT } from 'infrastructure/redis/redis.module';
import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { PaginatedDataDto } from '@/common/dto/paginated-data.dto';

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);

  constructor(
    private readonly revenueRepository: RevenueRepository,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async rebuildHistory(clearData = false): Promise<void> {
    const { deletedCount, insertedCount } = await this.revenueRepository.syncHistory(clearData);
    const invalidatedCacheKeys =
      deletedCount > 0 || insertedCount > 0 ? await this.clearHistoryCache() : 0;

    this.logger.log(
      `Revenue history sync completed deletedRows=${deletedCount} insertedRows=${insertedCount} invalidatedCacheKeys=${invalidatedCacheKeys}`,
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
