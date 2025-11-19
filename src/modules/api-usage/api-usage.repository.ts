import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiKeyUsageEvent } from './api-usage.entity';

@Injectable()
export class ApiKeyUsageRepository {
  constructor(
    @InjectRepository(ApiKeyUsageEvent)
    private readonly repository: Repository<ApiKeyUsageEvent>,
  ) {}

  create(data: Partial<ApiKeyUsageEvent>): ApiKeyUsageEvent {
    return this.repository.create(data);
  }

  save(entity: ApiKeyUsageEvent): Promise<ApiKeyUsageEvent> {
    return this.repository.save(entity);
  }
}
