import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NetworkService } from '@/common/chains/network/network.service';
import { Algorithm } from '@/common/enum/algorithm.enum';
import { SyncConfig } from '@/config/sync.config';
import { ReserveEntity } from '@/modules/history/entities';
import { SyncReserveAssetRole } from '@/modules/sync/enum/sync-reserve-asset-role.enum';
import { SyncReservesRequest } from '@/modules/sync/request/sync-reserves.request';
import { SyncRepository } from '@/modules/sync/sync.repository';
import { SyncReserveItem } from '@/modules/sync/types/sync-reserve-item.type';
import { SyncReservesPage } from '@/modules/sync/types/sync-reserves-page.type';

type ParsedSyncCursor = {
  updatedAt: Date;
  id?: number;
};

@Injectable()
export class SyncService {
  private readonly CURSOR_SEPARATOR = '-';

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly networkService: NetworkService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): SyncConfig {
    return this.configService.getOrThrow<SyncConfig>('sync');
  }

  async getCometReserves(request: SyncReservesRequest): Promise<SyncReservesPage<SyncReserveItem>> {
    const limit = request.limit ?? this.config.reserves.defaultLimit;
    const cursor = request.cursor ? this.parseCursor(request.cursor) : null;

    const reserves = await this.syncRepository.listCometReserves({
      limit: limit + 1,
      cursorUpdatedAt: cursor?.updatedAt,
      cursorId: cursor?.id,
    });
    const pageReserves = reserves.slice(0, limit);
    const lastReserve = pageReserves[pageReserves.length - 1] ?? null;

    return {
      data: pageReserves.map((reserve) => this.mapReserveItem(reserve)),
      limit,
      nextCursor: lastReserve ? this.buildCursor(lastReserve) : null,
      hasNextPage: reserves.length > limit,
    };
  }

  private parseCursor(cursor: string): ParsedSyncCursor {
    const { updatedAtValue, idValue } = this.splitCursor(cursor);
    const updatedAt = new Date(updatedAtValue);

    if (Number.isNaN(updatedAt.getTime())) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      updatedAt,
      id: idValue,
    };
  }

  private splitCursor(cursor: string): { updatedAtValue: string; idValue?: number } {
    const separatorIndex = cursor.lastIndexOf(this.CURSOR_SEPARATOR);
    if (separatorIndex < 0) {
      return { updatedAtValue: cursor };
    }

    const updatedAtValue = cursor.slice(0, separatorIndex);
    const idValue = Number(cursor.slice(separatorIndex + 1));
    const hasValidId = Number.isInteger(idValue) && idValue > 0;

    return hasValidId ? { updatedAtValue, idValue } : { updatedAtValue: cursor };
  }

  private buildCursor(reserve: ReserveEntity): string {
    return `${reserve.updatedAt.toISOString()}${this.CURSOR_SEPARATOR}${reserve.id}`;
  }

  private mapReserveItem(reserve: ReserveEntity): SyncReserveItem {
    return {
      chainId: this.networkService.byName(reserve.source.network).chainId,
      marketAddress: reserve.source.address,
      assetAddress: reserve.source.asset.address,
      assetSymbol: reserve.source.asset.symbol,
      assetDecimals: reserve.source.asset.decimals,
      assetRole: reserve.source.algorithm.includes(Algorithm.COMET_COLLATERAL)
        ? SyncReserveAssetRole.COLLATERAL
        : SyncReserveAssetRole.BASE,
      quantity: reserve.quantity,
      price: reserve.price,
      value: reserve.value,
      timestamp: Math.floor(reserve.date.getTime() / 1000),
      blockNumber: reserve.blockNumber,
      updatedAt: reserve.updatedAt,
    };
  }
}
