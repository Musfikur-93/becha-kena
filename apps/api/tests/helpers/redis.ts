import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';

import { setRedisClient } from '../../src/config/redis.js';

let mockInstance: Redis | null = null;

export function setupTestRedis(): Redis {
  mockInstance = new RedisMock() as unknown as Redis;
  setRedisClient(mockInstance);
  return mockInstance;
}

export async function clearTestRedis(): Promise<void> {
  if (mockInstance) {
    await mockInstance.flushall();
  }
}

export function teardownTestRedis(): void {
  if (mockInstance) {
    mockInstance.disconnect();
    mockInstance = null;
  }
  setRedisClient(null);
}
