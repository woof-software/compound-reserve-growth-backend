import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

import { SyncReserveResponse } from '@/modules/sync/response/sync-reserve.response';
import { SyncReservesCursorMetaResponse } from '@/modules/sync/response/sync-reserves-cursor-meta.response';
import { SyncReserveItem } from '@/modules/sync/types/sync-reserve-item.type';
import { SyncReservesPage } from '@/modules/sync/types/sync-reserves-page.type';

export class SyncReservesResponse {
  @IsArray()
  @ApiProperty({ type: SyncReserveResponse, isArray: true })
  public data: SyncReserveResponse[];

  @ApiProperty({ type: SyncReservesCursorMetaResponse })
  public meta: SyncReservesCursorMetaResponse;

  constructor(page: SyncReservesPage<SyncReserveItem>) {
    this.data = page.data.map((item) => new SyncReserveResponse(item));
    this.meta = new SyncReservesCursorMetaResponse(
      page.limit,
      page.lastItemCursor,
      page.hasNextPage,
    );
  }
}
