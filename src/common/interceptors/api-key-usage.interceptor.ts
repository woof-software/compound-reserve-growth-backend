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

import { TApiKeyUsageJobData } from '@/common/types/api-usage';
import { getApiKeyFromRequest } from '@/common/guards/api-key/api-key-storage';

@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
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

    const publish = (statusCode: number): void => {
      const payload: TApiKeyUsageJobData = {
        apiKey: apiKeyEntity.key,
        clientName: apiKeyEntity.clientName,
        targetUrl: this.buildTargetUrl(request),
        method: request.method,
        statusCode,
        ip: this.extractClientIp(request),
        domain: this.extractDomain(request),
        host: request.headers.host,
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
}
