import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { TApiKeyUsageJobData } from 'common/types/api-usage';

import { API_KEY_USAGE_JOB, API_KEY_USAGE_QUEUE } from './constants';

import { TBullmqJobOptions } from 'config/bullmq';

@Injectable()
export class ApiKeyUsageQueueService {
  private readonly logger = new Logger(ApiKeyUsageQueueService.name);

  constructor(
    @InjectQueue(API_KEY_USAGE_QUEUE)
    private readonly queue: Queue<TApiKeyUsageJobData>,
    private readonly configService: ConfigService,
  ) {}

  private get jobsOptions(): TBullmqJobOptions {
    return this.configService.get<TBullmqJobOptions>('bullmq.apiUsageQueue');
  }

  async enqueue(payload: TApiKeyUsageJobData): Promise<void> {
    try {
      await this.queue.add(API_KEY_USAGE_JOB, payload, this.jobsOptions);
    } catch (error) {
      this.logger.error(`Failed to enqueue API usage event: ${error.message}`, error.stack);
    }
  }
}
