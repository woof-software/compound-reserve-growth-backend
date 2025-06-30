export type TRedisConfig = {
  host: string;
  port: number;
  db: number;
  ttl: number;
  tls: object;
  timeout: number;
  password: string;
};

export default (): { redis: TRedisConfig } => ({
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? +process.env.REDIS_PORT : 6379,
    db: process.env.REDIS_DB ? +process.env.REDIS_DB : 0,
    ttl: process.env.REDIS_DEFAULT_TTL ? +process.env.REDIS_DEFAULT_TTL : 86400,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    timeout: process.env.REDIS_CONNECTION_TIMEOUT ? +process.env.REDIS_CONNECTION_TIMEOUT : 5000,
    password: process.env.REDIS_PASSWORD,
  },
});
