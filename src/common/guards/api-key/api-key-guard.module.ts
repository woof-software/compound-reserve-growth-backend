import { Module } from '@nestjs/common';

import { ApiKeyModule } from 'modules/api-key';

import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [ApiKeyModule],
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard, ApiKeyModule],
})
export class ApiKeyGuardModule {}
