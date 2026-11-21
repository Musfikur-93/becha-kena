import crypto from 'node:crypto';
import net from 'node:net';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getRedis } from '../../config/redis.js';
import { AppError } from '../../utils/AppError.js';

export interface RateLimitDimension {
  key: string;
  limit: number;
  windowSec: number;
}

export interface SlidingWindowResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtEpochSec: number;
  retryAfterSeconds: number;
}

/**
 * Extracts /24 subnet for IPv4 (e.g. 103.205.71.0/24) or /64 prefix for IPv6.
 */
export function ipSubnet24(rawIp: string | undefined): string {
  const ip = (rawIp ?? '127.0.0.1').replace(/^::ffff:/, '');
  if (net.isIPv4(ip)) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (net.isIPv6(ip)) {
    const parts = ip.split(':').slice(0, 4);
    return `${parts.join(':')}::/64`;
  }
  return ip;
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = tonumber(oldest[2]) or now
  local retryMs = math.max(1000, (oldestTs + windowMs) - now)
  return {0, count, retryMs}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, count + 1, windowMs}
`;

async function evaluateSingleDimension(dim: RateLimitDimension): Promise<SlidingWindowResult> {
  const redis = getRedis();
  const now = Date.now();
  const windowMs = dim.windowSec * 1000;
  const member = `${now}:${crypto.randomUUID()}`;

  let allowed = 0;
  let count = 0;
  let retryMs = windowMs;

  try {
    const res = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      dim.key,
      String(now),
      String(windowMs),
      String(dim.limit),
      member
    )) as [number, number, number];
    allowed = Number(res[0]);
    count = Number(res[1]);
    retryMs = Number(res[2]);
  } catch {
    // Fallback for lightweight mocks without Lua support (executes sorted-set ops sequentially)
    await redis.zremrangebyscore(dim.key, '-inf', now - windowMs);
    const current = await redis.zcard(dim.key);
    if (current >= dim.limit) {
      const oldest = await redis.zrange(dim.key, 0, 0, 'WITHSCORES');
      const oldestTs = oldest[1] ? Number(oldest[1]) : now;
      allowed = 0;
      count = current;
      retryMs = Math.max(1000, oldestTs + windowMs - now);
    } else {
      await redis.zadd(dim.key, now, member);
      await redis.pexpire(dim.key, windowMs);
      allowed = 1;
      count = current + 1;
      retryMs = windowMs;
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000));
  const remaining = Math.max(0, dim.limit - count);
  const resetAtEpochSec = Math.ceil((now + retryMs) / 1000);

  return {
    allowed: allowed === 1,
    limit: dim.limit,
    remaining,
    resetAtEpochSec,
    retryAfterSeconds
  };
}

/**
 * Evaluates multiple sliding-window dimensions (e.g. user + device + /24 subnet).
 * First checks all dimensions; if any is blocked, returns the tightest block result.
 */
export async function checkSlidingWindows(
  dimensions: RateLimitDimension[]
): Promise<SlidingWindowResult> {
  let strictest: SlidingWindowResult | null = null;

  for (const dim of dimensions) {
    const result = await evaluateSingleDimension(dim);
    if (!result.allowed) {
      return result;
    }
    if (!strictest || result.remaining < strictest.remaining) {
      strictest = result;
    }
  }

  return (
    strictest ?? {
      allowed: true,
      limit: 0,
      remaining: 0,
      resetAtEpochSec: Math.ceil(Date.now() / 1000),
      retryAfterSeconds: 0
    }
  );
}

export interface RateLimitMiddlewareOptions {
  dimensions: (req: Request) => RateLimitDimension[];
  message?: string;
}

export function rateLimit(options: RateLimitMiddlewareOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dims = options.dimensions(req);
      const result = await checkSlidingWindows(dims);

      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetAtEpochSec));

      if (!result.allowed) {
        next(
          AppError.rateLimited(
            options.message ?? 'Rate limit exceeded. Please try again later.',
            result.retryAfterSeconds
          )
        );
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
