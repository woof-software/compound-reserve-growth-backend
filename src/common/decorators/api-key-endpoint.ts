import { applyDecorators, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

import { ApiKeyGuard } from 'modules/api-key';
import { ApiKeyUsageInterceptor } from 'modules/api-usage';

export function ApiKeyEndpoint() {
  return applyDecorators(
    ApiSecurity('ApiKeyAuth'),
    UseGuards(ApiKeyGuard),
    UseInterceptors(ApiKeyUsageInterceptor),
  );
}
