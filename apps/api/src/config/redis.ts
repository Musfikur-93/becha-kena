import { Redis, type RedisOptions } from 'ioredis';

import { logger } from '../utils/logger.js';

import { config } from './env.js';

let primaryClient: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

function createClient(url: string, extraOptions: RedisOptions = {}): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    ...extraOptions
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  return client;
}

export function getRedis(): Redis {
  if (!primaryClient) {
    primaryClient = createClient(config.REDIS_URL);
  }
  return primaryClient;
}

export function setRedisClient(client: Redis | null): void {
  primaryClient = client;
}

export function getRedisPubSub(): { pub: Redis; sub: Redis } {
  if (!pubClient) {
    pubClient = createClient(config.REDIS_URL);
  }
  if (!subClient) {
    subClient = createClient(config.REDIS_URL);
  }
  return { pub: pubClient, sub: subClient };
}

export function createBullMqConnection(): Redis {
  return createClient(config.REDIS_URL, {
    maxRetriesPerRequest: null
  });
}

export async function getRedisStatus(): Promise<'up' | 'down'> {
  if (!primaryClient || primaryClient.status !== 'ready') {
    return 'down';
  }
  try {
    const pong = await primaryClient.ping();
    return pong === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export async function disconnectRedis(): Promise<void> {
  const clients = [primaryClient, pubClient, subClient].filter((c): c is Redis => c !== null);
  await Promise.all(
    clients.map(async (c) => {
      try {
        await c.quit();
      } catch {
        c.disconnect();
      }
    })
  );
  primaryClient = null;
  pubClient = null;
  subClient = null;
}
