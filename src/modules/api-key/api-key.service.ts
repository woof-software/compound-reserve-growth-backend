import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from 'modules/redis/redis.module';

import { ApiKey } from './api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { SearchApiKeyDto } from './dto/search-api-key.dto';
import { ApiKeyRepository } from './api-key.repository';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';
import { generateSecretKey } from '@/common/utils/generate-secret-key';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly CACHE_PREFIX = 'api_key:';

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  /**
   * Cache API key data (IPs and Domains) forever
   */
  private async cacheApiKey(apiKey: ApiKey): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${apiKey.key}`;
      const cacheData = {
        id: apiKey.id,
        clientName: apiKey.clientName,
        key: apiKey.key,
        ipWhitelist: apiKey.ipWhitelist,
        domainWhitelist: apiKey.domainWhitelist,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      };
      // Set without expiration (cache forever)
      await this.redisClient.set(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn(`Failed to cache API key: ${error.message}`);
    }
  }

  /**
   * Get API key from cache
   */
  async getApiKeyByKey(key: string): Promise<ApiKey | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as ApiKey;
      }

      const apiKey = await this.apiKeyRepository.findByKey(key);

      if (apiKey) {
        await this.cacheApiKey(apiKey);
      }

      return apiKey;
    } catch (error) {
      this.logger.error(`Failed to get API key: ${error.message}`);
    }
  }

  /**
   * Create a new API key
   */
  async create(createDto: CreateApiKeyDto): Promise<ApiKey> {
    const key = generateSecretKey();
    const apiKey = this.apiKeyRepository.create({
      clientName: createDto.clientName,
      key,
      ipWhitelist: createDto.ipWhitelist || [],
      domainWhitelist: createDto.domainWhitelist || [],
      status: ApiKeyStatus.ACTIVE,
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    await this.cacheApiKey(saved);

    this.logger.log(`Created API key for client: ${saved.clientName}`);
    return saved;
  }

  /**
   * Update an API key
   */
  async update(id: number, updateDto: UpdateApiKeyDto): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    if (apiKey.status === ApiKeyStatus.DELETED) {
      throw new BadRequestException('Cannot update a deleted API key');
    }

    if (updateDto.clientName !== undefined) {
      apiKey.clientName = updateDto.clientName;
    }
    if (updateDto.ipWhitelist !== undefined) {
      apiKey.ipWhitelist = updateDto.ipWhitelist;
    }
    if (updateDto.domainWhitelist !== undefined) {
      apiKey.domainWhitelist = updateDto.domainWhitelist;
    }

    const updated = await this.apiKeyRepository.save(apiKey);
    // Reset cache for updated key
    await this.resetCache(apiKey.key);

    this.logger.log(`Updated API key: ${updated.key}`);
    return updated;
  }

  /**
   * Pause an API key
   */
  async pause(id: number): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    if (apiKey.status === ApiKeyStatus.DELETED) {
      throw new BadRequestException('Cannot pause a deleted API key');
    }

    apiKey.status = ApiKeyStatus.PAUSED;
    const updated = await this.apiKeyRepository.save(apiKey);
    await this.resetCache(apiKey.key);

    this.logger.log(`Paused API key: ${updated.key}`);
    return updated;
  }

  /**
   * Activate an API key
   */
  async activate(id: number): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    if (apiKey.status === ApiKeyStatus.DELETED) {
      throw new BadRequestException('Cannot activate a deleted API key');
    }

    if (apiKey.status === ApiKeyStatus.ACTIVE) {
      return apiKey;
    }

    apiKey.status = ApiKeyStatus.ACTIVE;
    const updated = await this.apiKeyRepository.save(apiKey);
    await this.resetCache(apiKey.key);

    this.logger.log(`Activated API key: ${updated.key}`);
    return updated;
  }

  /**
   * Delete an API key (soft delete)
   */
  async delete(id: number): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    apiKey.status = ApiKeyStatus.DELETED;
    const updated = await this.apiKeyRepository.save(apiKey);
    await this.resetCache(apiKey.key);

    this.logger.log(`Deleted API key: ${updated.key}`);
    return updated;
  }

  /**
   * Search API keys
   */
  async search(searchDto: SearchApiKeyDto): Promise<ApiKey[]> {
    return this.apiKeyRepository.search(searchDto);
  }

  /**
   * Get API key by ID
   */
  async findOne(id: number): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    return apiKey;
  }

  /**
   * Reset cache for a specific API key
   */
  async resetCache(key?: string): Promise<void> {
    try {
      if (key) {
        const cacheKey = `${this.CACHE_PREFIX}${key}`;
        await this.redisClient.del(cacheKey);

        // Reload from database and cache again
        const apiKey = await this.apiKeyRepository.findByKey(key);
        if (apiKey) {
          await this.cacheApiKey(apiKey);
        }

        this.logger.log(`Reset cache for API key: ${key}`);
      } else {
        // Reset cache for all keys
        const keys = await this.redisClient.keys(`${this.CACHE_PREFIX}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }

        // Reload all active keys from database
        const apiKeys = await this.apiKeyRepository.findActive();

        for (const apiKey of apiKeys) {
          await this.cacheApiKey(apiKey);
        }

        this.logger.log(`Reset cache for all API keys`);
      }
    } catch (error) {
      this.logger.error(`Failed to reset cache: ${error.message}`);
    }
  }
}
