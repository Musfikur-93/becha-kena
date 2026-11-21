import 'dotenv/config';
import http from 'node:http';

import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectMongo, disconnectMongo } from './config/mongo.js';
import { disconnectRedis, getRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectMongo();
  try {
    await getRedis().connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err }, 'Redis initial connect failed; will retry lazily');
  }

  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Becha-Kena API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated');

    const hardTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s; forcing exit');
      process.exit(1);
    }, 10_000);
    hardTimeout.unref();

    server.close(async () => {
      try {
        await Promise.all([disconnectMongo(), disconnectRedis()]);
        logger.info('Connections closed cleanly');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during API bootstrap');
  process.exit(1);
});
