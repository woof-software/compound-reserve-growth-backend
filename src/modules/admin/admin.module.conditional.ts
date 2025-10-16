import { DynamicModule, Module } from '@nestjs/common';

import { HistoryModule } from 'modules/history/history.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import adminConfig from 'config/admin';

@Module({})
export class AdminModuleConditional {
  static forRoot(): DynamicModule {
    const adminToken = adminConfig().admin.token;
    if (!adminToken) {
      return {
        module: AdminModuleConditional,
        imports: [],
        providers: [],
        controllers: [],
        exports: [],
      };
    }

    return {
      module: AdminModuleConditional,
      imports: [HistoryModule],
      providers: [AdminService],
      exports: [AdminService],
      controllers: [AdminController],
    };
  }
}

export const getAdminModule = (): DynamicModule[] => {
  return [AdminModuleConditional.forRoot()];
};
