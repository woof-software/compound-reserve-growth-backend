import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { TApiKeyUsageJobData } from 'common/types/api-usage';

import { API_KEY_USAGE_JOB, API_KEY_USAGE_QUEUE } from './constants';

@Injectable()
export class ApiKeyUsageQueueService {
  private readonly logger = new Logger(ApiKeyUsageQueueService.name);

  constructor(
    @InjectQueue(API_KEY_USAGE_QUEUE)
    private readonly queue: Queue<TApiKeyUsageJobData>,
  ) {}

  async enqueue(payload: TApiKeyUsageJobData): Promise<void> {
    try {
      await this.queue.add(API_KEY_USAGE_JOB, payload, {
        removeOnComplete: 5000,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue API usage event: ${error.message}`, error.stack);
    }
  }
}
