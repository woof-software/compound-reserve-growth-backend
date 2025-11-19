import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiKey } from './api-key.entity';
import { SearchApiKeyDto } from './dto/search-api-key.dto';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';

@Injectable()
export class ApiKeyRepository {
  constructor(@InjectRepository(ApiKey) private readonly repository: Repository<ApiKey>) {}

  create(data: Partial<ApiKey>): ApiKey {
    return this.repository.create(data);
  }

  save(apiKey: ApiKey): Promise<ApiKey> {
    return this.repository.save(apiKey);
  }

  async findById(id: number): Promise<ApiKey | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByKey(key: string): Promise<ApiKey | null> {
    return this.repository.findOne({ where: { key } });
  }

  async findActive(): Promise<ApiKey[]> {
    return this.repository.find({ where: { status: ApiKeyStatus.ACTIVE } });
  }

  async findAllOrdered(): Promise<ApiKey[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async search(searchDto: SearchApiKeyDto): Promise<ApiKey[]> {
    const queryBuilder = this.repository.createQueryBuilder('apiKey').where('1 = 1');

    if (searchDto.clientName) {
      queryBuilder.andWhere('apiKey.clientName ILIKE :clientName', {
        clientName: `%${searchDto.clientName}%`,
      });
    }

    if (searchDto.status) {
      queryBuilder.andWhere('apiKey.status = :status', { status: searchDto.status });
    }

    if (searchDto.domain) {
      queryBuilder.andWhere('apiKey.domainWhitelist @> :domain', {
        domain: JSON.stringify([searchDto.domain]),
      });
    }

    return queryBuilder.orderBy('apiKey.createdAt', 'DESC').getMany();
  }
}
