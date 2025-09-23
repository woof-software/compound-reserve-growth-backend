import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AdminService } from 'modules/admin/admin.service';

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
}
