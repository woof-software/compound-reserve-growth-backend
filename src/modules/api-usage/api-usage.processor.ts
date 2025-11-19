import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { TApiKeyUsageJobData } from 'common/types/api-usage';

import { ApiKeyUsageService } from './api-usage.service';
import { API_KEY_USAGE_QUEUE } from './constants';

@Injectable()
@Processor(API_KEY_USAGE_QUEUE, {
  concurrency: 5,
})
export class ApiKeyUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(ApiKeyUsageProcessor.name);

  constructor(private readonly service: ApiKeyUsageService) {
    super();
  }

  async process(job: Job<TApiKeyUsageJobData>): Promise<void> {
    try {
      await this.service.persistEvent(job.data);
    } catch (error) {
      this.logger.error(`Failed to process API usage job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
