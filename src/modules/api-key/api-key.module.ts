import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKey } from './api-key.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyRepository } from './api-key.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  providers: [ApiKeyRepository, ApiKeyService],
  exports: [ApiKeyRepository, ApiKeyService],
})
export class ApiKeyModule {}
