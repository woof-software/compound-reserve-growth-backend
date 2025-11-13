import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

import { ApiKeyGuard } from 'modules/api-key';

export function ApiKeyEndpoint() {
  return applyDecorators(ApiSecurity('ApiKeyAuth'), UseGuards(ApiKeyGuard));
}
