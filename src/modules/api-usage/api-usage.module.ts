import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { ApiKeyUsageEvent } from './entities';
import { ApiKeyUsageRepository } from './api-usage.repository';
import { ApiKeyUsageService } from './api-usage.service';
import { ApiKeyUsageQueueService } from './api-usage.queue.service';
import { ApiKeyUsageProcessor } from './api-usage.processor';
import { API_KEY_USAGE_QUEUE } from './api-usage.constants';

import { ApiKeyUsageInterceptor } from '@/common/interceptors/api-key-usage.interceptor';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyUsageEvent]),
    BullModule.registerQueue({ name: API_KEY_USAGE_QUEUE }),
  ],
  providers: [
    ApiKeyUsageRepository,
    ApiKeyUsageService,
    ApiKeyUsageQueueService,
    ApiKeyUsageProcessor,
    ApiKeyUsageInterceptor,
  ],
  exports: [ApiKeyUsageQueueService, ApiKeyUsageInterceptor],
})
export class ApiUsageModule {}
