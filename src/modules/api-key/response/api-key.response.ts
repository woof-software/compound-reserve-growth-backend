import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApiKey } from 'modules/api-key';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';

type FullApiKey = ApiKey & { plainKey?: string };

export class ApiKeyResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  clientName: string;

  @ApiProperty({ description: 'SHA-256 hash of the API key' })
  keyHash: string;

  @ApiPropertyOptional({ description: 'Plain API key (returned only after creation)' })
  plainKey?: string;

  @ApiProperty({ type: [String] })
  ipWhitelist: string[];

  @ApiProperty({ type: [String] })
  domainWhitelist: string[];

  @ApiProperty({ enum: ApiKeyStatus })
  status: string;

  @ApiProperty({ example: 1750809600 })
  createdAt: number;

  @ApiProperty({ example: 1750809600 })
  updatedAt: number;

  constructor(apiKey: FullApiKey) {
    this.id = apiKey.id;
    this.clientName = apiKey.clientName;
    this.keyHash = apiKey.keyHash;
    if (apiKey.plainKey && apiKey.plainKey.length > 0) {
      this.plainKey = apiKey.plainKey;
    }
    this.ipWhitelist = apiKey.ipWhitelist;
    this.domainWhitelist = apiKey.domainWhitelist;
    this.status = apiKey.status;
    this.createdAt = new Date(apiKey.createdAt).getTime() / 1000;
    this.updatedAt = new Date(apiKey.updatedAt).getTime() / 1000;
  }
}
