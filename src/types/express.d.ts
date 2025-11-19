import { ApiKey } from 'modules/api-key';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      /**
       * Injected API key entity after the ApiKeyGuard successfully validates the request.
       */
      apiKey?: ApiKey;
    }
  }
}

export {};
