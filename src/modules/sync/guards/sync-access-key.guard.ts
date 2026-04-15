import { createHash, timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';

import { SyncAccessKeyHeaderDto } from '@/modules/sync/dto/sync-access-key-header.dto';

@Injectable()
export class SyncAccessKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawHeader = request.headers['x-sync-access-key'];

    if (Array.isArray(rawHeader)) {
      throw new UnauthorizedException('X-Sync-Access-Key header must contain a single value');
    }

    const header = plainToInstance(SyncAccessKeyHeaderDto, request.headers, {
      enableImplicitConversion: true,
      excludeExtraneousValues: true,
    });
    const errors = await validate(header, {
      stopAtFirstError: true,
      validationError: {
        target: false,
        value: false,
      },
    });

    if (errors.length > 0) {
      const [firstError] = errors;
      const [message] = Object.values(firstError?.constraints ?? {});
      throw new UnauthorizedException(message);
    }

    const accessKeyHash = this.configService.getOrThrow<string>('sync.accessKeyHash');

    if (!this.compareWithHash(accessKeyHash, header.key)) {
      throw new UnauthorizedException('Invalid sync access key');
    }

    return true;
  }

  private compareWithHash(expectedHash: string, headerValue: string): boolean {
    const normalizedExpectedHash = expectedHash.trim().toLowerCase();
    const incomingHash = createHash('sha256').update(headerValue, 'utf8').digest('hex');

    if (normalizedExpectedHash.length !== incomingHash.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(normalizedExpectedHash, 'utf8'),
      Buffer.from(incomingHash, 'utf8'),
    );
  }
}
