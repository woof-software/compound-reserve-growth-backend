import { Controller, Get, Post, Query, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AdminService } from 'modules/admin/admin.service';
import { StartCollectionResponse } from 'modules/admin/response';

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
    summary: 'Start reserves processing',
    description: 'Returns the process status response.',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startReserves(@Query() request: StartCollectionResponse): Promise<string> {
    return this.admin.startReserves(request);
  }

  @Post('/stats/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Start stats processing',
    description: 'Returns the process status response.',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startStats(@Query() request: StartCollectionResponse): Promise<string> {
    return this.admin.startStats(request);
  }
}
