import { Router } from 'express';

import { getMongoStatus } from '../../../config/mongo.js';
import { getRedisStatus } from '../../../config/redis.js';
import { ok } from '../../../utils/response.js';
import { API_VERSION } from '../../middlewares/apiVersion.js';

export function createV1Router(): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const mongo = getMongoStatus();
    const redis = await getRedisStatus();

    ok(res, {
      status: 'ok',
      mongo,
      redis,
      uptime: Math.floor(process.uptime()),
      version: API_VERSION
    });
  });

  return router;
}
