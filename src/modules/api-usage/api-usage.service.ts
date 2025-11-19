import { Injectable, Logger } from '@nestjs/common';

import { ApiKeyUsageRepository } from './api-usage.repository';
import { TApiKeyUsageJobData } from './api-usage.types';

@Injectable()
export class ApiKeyUsageService {
  private readonly logger = new Logger(ApiKeyUsageService.name);

  constructor(private readonly repository: ApiKeyUsageRepository) {}

  async persistEvent(payload: TApiKeyUsageJobData): Promise<void> {
    try {
      const entity = this.repository.create({
        apiKeyId: payload.apiKeyId,
        apiKey: payload.apiKey,
        clientName: payload.clientName,
        method: payload.method,
        targetUrl: payload.targetUrl,
        statusCode: payload.statusCode,
        durationMs: payload.durationMs,
        ip: payload.ip,
        domain: payload.domain,
        host: payload.host,
        userAgent: payload.userAgent,
        requestContext: payload.requestContext,
        occurredAt: new Date(payload.occurredAt),
      });

      await this.repository.save(entity);
    } catch (error) {
      this.logger.error(`Failed to persist API usage event: ${error.message}`, error.stack);
    }
  }
}
