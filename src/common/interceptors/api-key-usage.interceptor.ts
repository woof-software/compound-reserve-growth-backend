import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ApiKeyUsageQueueService } from 'modules/api-usage';

import { TApiKeyUsageJobData, TRequestContextSnapshot } from '@/common/types/api-usage';
import { getApiKeyFromRequest } from '@/common/guards/api-key/api-key-storage';

@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
  private readonly sensitiveKeys = ['password', 'secret', 'token', 'key', 'authorization'];

  constructor(private readonly queueService: ApiKeyUsageQueueService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    if (!request) {
      return next.handle();
    }

    const apiKeyEntity = getApiKeyFromRequest(request);

    if (!apiKeyEntity) {
      return next.handle();
    }

    const startedAt = Date.now();
    const publish = (statusCode: number): void => {
      const payload: TApiKeyUsageJobData = {
        apiKeyId: apiKeyEntity.id,
        apiKey: apiKeyEntity.key,
        clientName: apiKeyEntity.clientName,
        targetUrl: this.buildTargetUrl(request),
        method: request.method,
        statusCode,
        durationMs: Date.now() - startedAt,
        ip: this.extractClientIp(request),
        domain: this.extractDomain(request),
        host: request.headers.host,
        userAgent: request.headers['user-agent'] as string | undefined,
        requestContext: this.buildRequestContext(request),
        occurredAt: new Date().toISOString(),
      };

      void this.queueService.enqueue(payload);
    };

    return next.handle().pipe(
      tap({
        next: () => publish(response.statusCode),
        error: (err) => {
          const status =
            err instanceof HttpException ? err.getStatus() : response.statusCode || 500;
          publish(status);
        },
      }),
    );
  }

  private extractApiKeyHeader(request: Request): string | undefined {
    const header = request.header('x-api-key');
    return header?.trim();
  }

  private buildTargetUrl(request: Request): string {
    const originalUrl = request.originalUrl || request.url || '';
    return `${request.method} ${originalUrl}`;
  }

  private extractClientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first?.trim();
    }
    return request.ip || request.socket.remoteAddress || undefined;
  }

  private extractDomain(request: Request): string | undefined {
    const origin = (request.headers.origin || request.headers.referer) as string | undefined;
    if (!origin) {
      return undefined;
    }

    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return origin;
    }
  }

  private buildRequestContext(request: Request): TRequestContextSnapshot | undefined {
    const context: TRequestContextSnapshot = {};

    const params = this.sanitizePayload(request.params);
    if (params) {
      context.params = params;
    }

    const query = this.sanitizePayload(request.query);
    if (query) {
      context.query = query;
    }

    const body = this.sanitizePayload(request.body);
    if (body) {
      context.body = body;
    }

    return Object.keys(context).length > 0 ? context : undefined;
  }

  private sanitizePayload(payload: unknown): Record<string, unknown> | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const cloned = this.safeClone(payload);
    this.redactSensitive(cloned);

    return Object.keys(cloned).length > 0 ? cloned : undefined;
  }

  private safeClone(value: unknown, depth = 0, seen = new WeakSet()): any {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (seen.has(value as object)) {
      return '[Circular]';
    }

    if (depth > 5) {
      return '[MaxDepth]';
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.slice(0, 25).map((item) => this.safeClone(item, depth + 1, seen));
    }

    return Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = this.safeClone(val, depth + 1, seen);
        return acc;
      }, {});
  }

  private redactSensitive(input: unknown): void {
    if (Array.isArray(input)) {
      input.forEach((item) => this.redactSensitive(item));
      return;
    }

    if (!input || typeof input !== 'object') {
      return;
    }

    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      if (this.sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        (input as Record<string, unknown>)[key] = '[REDACTED]';
        return;
      }

      if (typeof value === 'object' && value !== null) {
        this.redactSensitive(value);
      }
    });
  }
}
