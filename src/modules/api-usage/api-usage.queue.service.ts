import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { API_KEY_USAGE_JOB, API_KEY_USAGE_QUEUE } from './constants';

import { ApiKeyUsageJobData } from '@/common/types/api-key-usage-job-data';
import { BullmqJobOptions } from 'config/bullmq';

@Injectable()
export class ApiKeyUsageQueueService {
  private readonly logger = new Logger(ApiKeyUsageQueueService.name);

  constructor(
    @InjectQueue(API_KEY_USAGE_QUEUE)
    private readonly queue: Queue<ApiKeyUsageJobData>,
    private readonly configService: ConfigService,
  ) {}

  private get jobsOptions(): BullmqJobOptions {
    return this.configService.get<BullmqJobOptions>('bullmq.apiUsageQueue');
  }

  async enqueue(payload: ApiKeyUsageJobData): Promise<void> {
    try {
      await this.queue.add(API_KEY_USAGE_JOB, payload, this.jobsOptions);
    } catch (error) {
      this.logger.error(`Failed to enqueue API usage event: ${error.message}`, error.stack);
    }
  }
}
