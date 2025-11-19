import { Request } from 'express';

import { ApiKey } from 'modules/api-key';

const apiKeyStorage = new WeakMap<Request, ApiKey>();

export function setApiKeyForRequest(request: Request, apiKey: ApiKey): void {
  apiKeyStorage.set(request, apiKey);
}

export function getApiKeyFromRequest(request: Request): ApiKey | undefined {
  return apiKeyStorage.get(request);
}
