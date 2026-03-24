import { Controller, Get, Post, Query, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AdminService } from 'modules/admin/admin.service';
import { StartCollectionRequest } from 'modules/admin/request';

import { AdminEndpoint } from '@/common/decorators';

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
      'Queues a reserves processing job and returns the queue status response.\n' +
      '  - If the `clearData` field is set to true in the request, existing data in the database will be cleared before the queued collection starts.\n' +
      '  - The `data` field specifies the time (in ISO format) at which data collection should start.\n' +
      '  - When `clearData` is enabled and `data` is not specified, the start of the report is considered to be the contract creation date',
  })
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
      'Queues a stats processing job and returns the queue status response.\n' +
      '  - If the `clearData` field is set to true in the request, existing data in the database will be cleared before the queued collection starts.\n' +
      '  - The `data` field specifies the time (in ISO format) at which data collection should start.\n' +
      '  - When `clearData` is enabled and `data` is not specified, the start of the report is considered to be the contract creation date',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startStats(@Query() request: StartCollectionRequest): Promise<string> {
    return this.admin.startStats(request);
  }
}
