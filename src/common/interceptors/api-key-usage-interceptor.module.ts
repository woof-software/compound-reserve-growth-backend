import { Module } from '@nestjs/common';

import { ApiUsageModule } from 'modules/api-usage';

import { ApiKeyUsageInterceptor } from './api-key-usage.interceptor';

@Module({
  imports: [ApiUsageModule],
  providers: [ApiKeyUsageInterceptor],
  exports: [ApiKeyUsageInterceptor],
})
export class ApiKeyUsageInterceptorModule {}
