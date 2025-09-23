import { Module } from '@nestjs/common';

import { ContractModule } from 'modules/contract/contract.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ContractModule],
  providers: [AdminService],
  exports: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
