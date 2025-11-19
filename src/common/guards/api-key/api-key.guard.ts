import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

import { ApiKeyService } from 'modules/api-key/api-key.service';

import { validateApiKeyHeader } from './validate-api-key-header';
import { setApiKeyForRequest } from './api-key-storage';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract API key from X-Api-Key header
    const headers = await validateApiKeyHeader(context);
    const token = headers.key;

    if (!token) {
      throw new UnauthorizedException('X-Api-Key header is required');
    }

    // Get API key from cache or database
    const apiKey = await this.apiKeyService.getApiKeyByKey(token);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check status
    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new ForbiddenException('API key is not active');
    }

    // Validate IP address
    const clientIp = this.getClientIp(request);
    if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0) {
      if (!this.isIpAllowed(clientIp, apiKey.ipWhitelist)) {
        throw new ForbiddenException('IP address not allowed');
      }
    }

    // Validate domain/referer
    const referer = request.headers.referer || request.headers.origin;
    if (apiKey.domainWhitelist && apiKey.domainWhitelist.length > 0) {
      if (!referer) {
        throw new ForbiddenException('Referer or Origin header is required');
      }
      if (!this.isDomainAllowed(referer, apiKey.domainWhitelist)) {
        throw new ForbiddenException('Domain not allowed');
      }
    }

    // Store API key in WeakMap for interceptor to access
    setApiKeyForRequest(request, apiKey);

    return true;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }
    return request.ip || request.socket.remoteAddress || '0.0.0.0';
  }

  /**
   * Check if IP is allowed
   */
  private isIpAllowed(ip: string, whitelist: string[]): boolean {
    // If whitelist is empty, allow all
    if (whitelist.length === 0) {
      return true;
    }

    // Check exact match
    if (whitelist.includes(ip)) {
      return true;
    }

    // Check CIDR notation (e.g., 192.168.1.0/24)
    for (const allowedIp of whitelist) {
      if (allowedIp.includes('/')) {
        if (this.isIpInCidr(ip, allowedIp)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = ~(2 ** (32 - parseInt(prefixLength)) - 1);

      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Check if domain is allowed
   */
  private isDomainAllowed(referer: string, whitelist: string[]): boolean {
    // If whitelist is empty, allow all
    if (whitelist.length === 0) {
      return true;
    }

    try {
      const url = new URL(referer);
      const hostname = url.hostname.toLowerCase();

      for (const allowedDomain of whitelist) {
        const domain = allowedDomain.toLowerCase();

        // Exact match
        if (hostname === domain) {
          return true;
        }

        // Subdomain match (e.g., *.example.com matches sub.example.com)
        if (domain.startsWith('*.')) {
          const baseDomain = domain.substring(2);
          if (hostname === baseDomain || hostname.endsWith('.' + baseDomain)) {
            return true;
          }
        }

        // Suffix match (e.g., example.com matches sub.example.com)
        if (hostname.endsWith('.' + domain) || hostname === domain) {
          return true;
        }
      }
    } catch {
      // Invalid URL, deny access
      return false;
    }

    return false;
  }
}
