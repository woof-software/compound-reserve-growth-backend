import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { ApiKeyGuard } from 'modules/api-key';

export function ApiKeyEndpoint() {
  return applyDecorators(ApiBearerAuth(), UseGuards(ApiKeyGuard));
}
