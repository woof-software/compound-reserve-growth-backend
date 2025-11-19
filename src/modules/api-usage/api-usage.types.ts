export type TRequestContextSnapshot = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

export type TApiKeyUsageJobData = {
  apiKeyId?: number;
  apiKey: string;
  clientName?: string;
  targetUrl: string;
  method: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
  domain?: string;
  host?: string;
  userAgent?: string;
  requestContext?: TRequestContextSnapshot;
  occurredAt: string;
};
