import { EventEmitter } from 'events';

/**
 * No-op Redis client for environments where Redis is not configured (e.g. CLI without REDIS_HOST).
 * Implements the subset of ioredis API used by PriceService and others; all operations are no-ops.
 */
function createRedisNoop(): RedisNoop {
  const noopPipeline = {
    del: () => noopPipeline,
    setex: () => noopPipeline,
    exec: () => Promise.resolve([]),
  };

  const scanStream = () => {
    const ee = new EventEmitter();
    setImmediate(() => ee.emit('end'));
    return ee;
  };

  return {
    ping: () => Promise.resolve('PONG'),
    get: () => Promise.resolve(null),
    setex: () => Promise.resolve('OK'),
    del: () => Promise.resolve(0),
    scanStream,
    pipeline: () => noopPipeline,
  };
}

export type RedisNoop = {
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttl: number, value: string) => Promise<string>;
  del: (...keys: string[]) => Promise<number>;
  scanStream: (opts: { match: string; count?: number }) => EventEmitter;
  pipeline: () => {
    del: (...keys: string[]) => unknown;
    setex: (key: string, ttl: number, value: string) => unknown;
    exec: () => Promise<unknown[]>;
  };
};

let instance: RedisNoop | null = null;

export function getRedisNoop(): RedisNoop {
  if (!instance) instance = createRedisNoop();
  return instance;
}
