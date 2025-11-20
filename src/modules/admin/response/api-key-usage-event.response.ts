import { ApiProperty } from '@nestjs/swagger';

import { ApiKeyUsageEvent } from 'modules/api-usage/entities/api-usage.entity';

export class ApiKeyUsageEventResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  apiKey: string;

  @ApiProperty({ required: false })
  clientName?: string;

  @ApiProperty()
  method: string;

  @ApiProperty()
  targetUrl: string;

  @ApiProperty()
  statusCode: number;

  @ApiProperty({ required: false })
  ip?: string;

  @ApiProperty({ required: false })
  domain?: string;

  @ApiProperty({ required: false })
  host?: string;

  @ApiProperty({ description: 'ISO date string' })
  occurredAt: string;

  @ApiProperty({ description: 'ISO date string' })
  createdAt: string;

  constructor(event: ApiKeyUsageEvent) {
    this.id = event.id;
    this.apiKey = event.apiKey;
    this.clientName = event.clientName;
    this.method = event.method;
    this.targetUrl = event.targetUrl;
    this.statusCode = event.statusCode;
    this.ip = event.ip;
    this.domain = event.domain;
    this.host = event.host;
    this.occurredAt = event.occurredAt.toISOString();
    this.createdAt = event.createdAt.toISOString();
  }
}
