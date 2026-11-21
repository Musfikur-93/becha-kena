import { ERROR_CODES, uuidV4Schema } from '@becha-kena/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getRedis } from '../../config/redis.js';
import { AppError } from '../../utils/AppError.js';
import { sha256 } from '../../utils/crypto.js';

const IDEMPOTENCY_TTL_SECONDS = 86_400;

interface CachedIdempotencyRecord {
  state: 'processing' | 'completed';
  bodyHash: string;
  status?: number;
  body?: unknown;
}

export function requireIdempotency(options: { optional?: boolean } = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = req.headers['idempotency-key'];
      if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
        if (options.optional) {
          next();
          return;
        }
        throw AppError.badRequest(
          'Idempotency-Key header (UUIDv4) is required for this operation.',
          ERROR_CODES.VALIDATION_ERROR,
          [
            {
              field: 'Idempotency-Key',
              code: 'REQUIRED',
              message: 'Missing required Idempotency-Key header.'
            }
          ]
        );
      }

      const parsedKey = uuidV4Schema.safeParse(rawKey.trim());
      if (!parsedKey.success) {
        throw AppError.badRequest(
          'Idempotency-Key header must be a valid UUID.',
          ERROR_CODES.VALIDATION_ERROR,
          [
            {
              field: 'Idempotency-Key',
              code: 'INVALID_STRING',
              message: 'Idempotency-Key must be a valid UUID.'
            }
          ]
        );
      }

      const actor = req.user?.id ?? req.ip ?? 'anon';
      const routeKey = `${req.baseUrl}${req.path}`;
      const redisKey = `idem:${actor}:${routeKey}:${parsedKey.data}`;
      const bodyHash = sha256(JSON.stringify(req.body ?? {}));

      const redis = getRedis();
      const existingRaw = await redis.get(redisKey);

      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as CachedIdempotencyRecord;
        if (existing.bodyHash !== bodyHash) {
          throw AppError.unprocessable(
            'Idempotency-Key was already used with a different request payload.',
            ERROR_CODES.IDEMPOTENCY_KEY_REUSED
          );
        }
        if (existing.state === 'processing') {
          throw AppError.conflict(
            'A request with this Idempotency-Key is currently being processed.'
          );
        }
        res.status(existing.status ?? 200).json(existing.body);
        return;
      }

      const lockRecord: CachedIdempotencyRecord = {
        state: 'processing',
        bodyHash
      };
      const acquired = await redis.set(
        redisKey,
        JSON.stringify(lockRecord),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
        'NX'
      );

      if (!acquired) {
        throw AppError.conflict('A request with this Idempotency-Key is already in flight.');
      }

      // Intercept res.json to persist completed responses and release lock on 5xx errors
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          const completed: CachedIdempotencyRecord = {
            state: 'completed',
            bodyHash,
            status: res.statusCode,
            body
          };
          void redis.set(redisKey, JSON.stringify(completed), 'EX', IDEMPOTENCY_TTL_SECONDS);
        } else {
          void redis.del(redisKey);
        }
        return originalJson(body);
      }) as typeof res.json;

      res.on('close', () => {
        if (!res.writableEnded) {
          void redis.del(redisKey);
        }
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
