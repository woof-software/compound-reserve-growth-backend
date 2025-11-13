import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { validateAdminHeader } from './validate-admin-header';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminToken: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.adminToken = this.configService.get<string>('admin.token');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.adminToken) {
      return false;
    }

    const headers = await validateAdminHeader(context);

    if (!headers.token) {
      throw new BadRequestException('X-Admin-Token header is required');
    }

    return this.adminToken === headers.token;
  }
}
