import { Module } from '@nestjs/common';

import { HistoryModule } from 'modules/history/history.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApiKeyGuardModule } from '@/common/guards/api-key';

@Module({
  imports: [HistoryModule, ApiKeyGuardModule],
  providers: [AdminService],
  exports: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
