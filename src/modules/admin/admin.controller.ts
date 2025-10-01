import { Body, Controller, Get, Post, SerializeOptions } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import { AdminService } from 'modules/admin/admin.service';
import { StartReservesDto, StartStatsDto } from 'modules/admin/dto';

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
  @ApiBody({
    type: StartReservesDto,
    description: 'Reserves processing parameters',
    examples: {
      default: {
        summary: 'Default processing',
        value: {
          enableFlag: false,
          optionalParam: null
        }
      },
      withFlag: {
        summary: 'With flag enabled',
        value: {
          enableFlag: true,
          optionalParam: 'custom-value'
        }
      }
    }
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startReserves(@Body() dto: StartReservesDto): Promise<string> {
    return this.admin.startReserves(dto);
  }

  @Post('/stats/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Start stats processing',
    description: 'Returns the process status response.',
  })
  @ApiBody({
    type: StartStatsDto,
    description: 'Stats processing parameters',
    examples: {
      default: {
        summary: 'Default processing',
        value: {
          enableFlag: false,
          optionalParam: null
        }
      },
      withFlag: {
        summary: 'With flag enabled',
        value: {
          enableFlag: true,
          optionalParam: 'custom-value'
        }
      }
    }
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startStats(@Body() dto: StartStatsDto): Promise<string> {
    return this.admin.startStats(dto);
  }
}
