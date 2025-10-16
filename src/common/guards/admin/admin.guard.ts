import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { validateBearerHeader } from 'common/guards/validate-bearer-header';
import { extractToken } from 'common/guards/exctract-token';

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

    const headers = await validateBearerHeader(context);

    return this.adminToken === extractToken(headers.authorization);
  }
}
