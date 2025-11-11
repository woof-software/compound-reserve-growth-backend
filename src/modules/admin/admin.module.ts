import { Module } from '@nestjs/common';

import { HistoryModule } from 'modules/history/history.module';
import { ApiKeyModule } from 'modules/api-key/api-key.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [HistoryModule, ApiKeyModule],
  providers: [AdminService],
  exports: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
