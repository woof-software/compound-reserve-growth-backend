import * as process from 'node:process';

export type TCorsConfig = {
  origin: '*' | true | string[];
  credentials: boolean;
};

export type TAppConfig = {
  host: string;
  port: number;
  cors: TCorsConfig;
  apiDocumentation: boolean;
  logLevel: string;
};

export default (): { app: TAppConfig } => {
  const rawOrigin = process.env.APP_CORS_ORIGIN || '*';

  const cors: TCorsConfig =
    rawOrigin === '*cred'
      ? { origin: true, credentials: true } // any Origin + cookies
      : rawOrigin === '*'
        ? { origin: '*', credentials: false } // any Origin, no cookies
        : { origin: rawOrigin.split(','), credentials: true }; // domain list + cookies

  return {
    app: {
      host: process.env.APP_HOST || '0.0.0.0',
      port: Number(process.env.APP_PORT) || 3000,
      cors,
      apiDocumentation: process.env.API_DOCUMENTATION === 'true',
      logLevel: process.env.LOG_LEVEL || 'error',
    },
  };
};
