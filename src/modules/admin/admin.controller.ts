import { Controller, Get, Post, Query, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { AdminService } from '@/modules/admin/admin.service';
import { StartCollectionRequest } from '@/modules/admin/request';
import { AdminEndpoint } from '@/common/decorators';

const COLLECTION_CLEAR_DATA_QUERY = {
  name: 'clearData',
  required: false,
  type: Boolean,
  description: 'Whether to clear existing history before the queued collection starts.',
  example: false,
} as const;

const COLLECTION_DATE_QUERY = {
  name: 'data',
  required: false,
  type: String,
  description:
    'Collection start timestamp in ISO 8601 format. If omitted while `clearData=true`, collection starts from the contract creation date.',
  example: '2025-05-01',
} as const;

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('/access')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Test admin access',
    description: 'Returns OK if has admin access.',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  testAccess(): string {
    return 'OK';
  }

  @Post('/reserves/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Queue reserves processing',
    description:
      'Queues a reserves processing job and returns the queue status response. ' +
      'This endpoint accepts request parameters via query string.',
  })
  @ApiQuery(COLLECTION_CLEAR_DATA_QUERY)
  @ApiQuery(COLLECTION_DATE_QUERY)
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startReserves(@Query() request: StartCollectionRequest): Promise<string> {
    return this.admin.startReserves(request);
  }

  @Post('/stats/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Queue stats processing',
    description:
      'Queues a stats processing job and returns the queue status response. ' +
      'This endpoint accepts request parameters via query string.',
  })
  @ApiQuery(COLLECTION_CLEAR_DATA_QUERY)
  @ApiQuery(COLLECTION_DATE_QUERY)
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startStats(@Query() request: StartCollectionRequest): Promise<string> {
    return this.admin.startStats(request);
  }
}
