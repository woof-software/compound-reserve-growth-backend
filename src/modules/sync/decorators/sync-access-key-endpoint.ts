import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { SyncAccessKeyGuard } from '@/modules/sync/guards/sync-access-key.guard';

export function SyncAccessKeyEndpoint() {
  return applyDecorators(
    ApiSecurity('SyncAccessKey'),
    ApiUnauthorizedResponse({ description: 'Missing or invalid X-Sync-Access-Key header.' }),
    UseGuards(SyncAccessKeyGuard),
  );
}
