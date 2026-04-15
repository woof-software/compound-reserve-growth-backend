import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from '@/common/chains/network/network.module';
import { ReserveEntity } from '@/modules/history/entities';
import { SyncAccessKeyGuard } from '@/modules/sync/guards/sync-access-key.guard';
import { SyncReservesController } from '@/modules/sync/sync-reserves.controller';
import { SyncRepository } from '@/modules/sync/sync.repository';
import { SyncService } from '@/modules/sync/sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReserveEntity]), NetworkModule],
  providers: [SyncRepository, SyncService, SyncAccessKeyGuard],
  controllers: [SyncReservesController],
})
export class SyncModule {}
