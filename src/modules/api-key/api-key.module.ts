import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKey } from './api-key.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyRepository } from './api-key.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  providers: [ApiKeyRepository, ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyRepository, ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}
