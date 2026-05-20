import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { SyncAccessKeyEndpoint } from '@/modules/sync/decorators/sync-access-key-endpoint';
import { SyncReservesRequest } from '@/modules/sync/request/sync-reserves.request';
import { SyncReservesResponse } from '@/modules/sync/response/sync-reserves.response';
import { SyncService } from '@/modules/sync/sync.service';

@Controller('sync/reserves')
export class SyncReservesController {
  constructor(private readonly syncService: SyncService) {}

  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @SyncAccessKeyEndpoint()
  @ApiOperation({
    summary: 'Get COMET and COMET collateral reserves for sync',
    description:
      'Returns reserve rows ordered for incremental synchronization. Use lastItemCursor from the response meta as the cursor for the next request. Reserves from Ronin (2020) and Scroll (534352) are excluded.',
  })
  @ApiResponse({ status: 200, type: SyncReservesResponse })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getCometReserves(@Query() request: SyncReservesRequest): Promise<SyncReservesResponse> {
    const page = await this.syncService.getCometReserves(request);
    return new SyncReservesResponse(page);
  }
}
