import { Injectable, Logger } from '@nestjs/common';

import { ApiKeyUsageRepository } from './api-usage.repository';
import { SearchApiUsageEventsDto } from './dto/search-api-usage-events.dto';
import { ApiKeyUsageEvent } from './entities';

import { ApiKeyUsageJobData } from '@/common/types/api-key-usage-job-data';

@Injectable()
export class ApiKeyUsageService {
  private readonly logger = new Logger(ApiKeyUsageService.name);

  constructor(private readonly repository: ApiKeyUsageRepository) {}

  async persistEvent(payload: ApiKeyUsageJobData): Promise<void> {
    try {
      const entity = this.repository.create({
        apiKey: payload.apiKey,
        clientName: payload.clientName,
        method: payload.method,
        targetUrl: payload.targetUrl,
        statusCode: payload.statusCode,
        ip: payload.ip,
        domain: payload.domain,
        host: payload.host,
        occurredAt: new Date(payload.occurredAt),
      });

      await this.repository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to persist API usage event: ${error.message}`, error.stack);
    }
  }

  async searchEvents(filters: SearchApiUsageEventsDto): Promise<ApiKeyUsageEvent[]> {
    return this.repository.findByFilters(filters);
  }
}
