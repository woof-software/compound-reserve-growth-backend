import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AdminGuard } from 'common/guards/admin';

export function AdminEndpoint() {
  return applyDecorators(ApiBearerAuth(), UseGuards(AdminGuard));
}
