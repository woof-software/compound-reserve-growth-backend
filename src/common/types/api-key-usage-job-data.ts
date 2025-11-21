export type ApiKeyUsageJobData = {
  apiKey: string;
  clientName?: string;
  targetUrl: string;
  method: string;
  statusCode: number;
  ip?: string;
  domain?: string;
  host?: string;
  occurredAt: string;
};
