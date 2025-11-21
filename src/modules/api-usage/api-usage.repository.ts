import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from '@/common/enum/order.enum';

import { ApiKeyUsageEvent } from './entities';
import { SearchApiUsageEventsDto } from './dto/search-api-usage-events.dto';

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

  findByFilters(filters: SearchApiUsageEventsDto): Promise<ApiKeyUsageEvent[]> {
    const qb = this.repository
      .createQueryBuilder('event')
      .orderBy('event.createdAt', filters.order ?? Order.DESC);

    if (filters.apiKey) {
      qb.andWhere('event.apiKey = :apiKey', { apiKey: filters.apiKey });
    }

    if (filters.clientName) {
      qb.andWhere('event.clientName ILIKE :clientName', { clientName: `%${filters.clientName}%` });
    }

    if (filters.method) {
      qb.andWhere('event.method = :method', { method: filters.method });
    }

    // default cap to avoid unbounded payloads
    qb.take(200);

    return qb.getMany();
  }
}
