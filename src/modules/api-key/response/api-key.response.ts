import { ApiProperty } from '@nestjs/swagger';

import { ApiKey } from 'modules/api-key';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';

export class ApiKeyResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  clientName: string;

  @ApiProperty({ description: 'API key' })
  key: string;

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

  constructor(apiKey: ApiKey) {
    this.id = apiKey.id;
    this.clientName = apiKey.clientName;
    this.key = apiKey.key;
    this.ipWhitelist = apiKey.ipWhitelist;
    this.domainWhitelist = apiKey.domainWhitelist;
    this.status = apiKey.status;
    this.createdAt = new Date(apiKey.createdAt).getTime() / 1000;
    this.updatedAt = new Date(apiKey.updatedAt).getTime() / 1000;
  }
}
