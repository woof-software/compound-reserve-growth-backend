import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

import { AdminGuard } from 'common/guards/admin';

export function AdminEndpoint() {
  return applyDecorators(ApiSecurity('AdminToken'), UseGuards(AdminGuard));
}
