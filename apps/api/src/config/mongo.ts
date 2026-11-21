import mongoose, { type ClientSession } from 'mongoose';

import { logger } from '../utils/logger.js';

import { config } from './env.js';

export async function connectMongo(uri: string = config.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  return mongoose.connect(uri, {
    retryWrites: true,
    w: 'majority'
  });
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getMongoStatus(): 'up' | 'down' {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
}

function isTransientTransactionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const maybeError = err as { hasErrorLabel?: (label: string) => boolean; errorLabels?: string[] };
  if (typeof maybeError.hasErrorLabel === 'function') {
    return maybeError.hasErrorLabel('TransientTransactionError');
  }
  return Array.isArray(maybeError.errorLabels)
    ? maybeError.errorLabels.includes('TransientTransactionError')
    : false;
}

/**
 * Executes a callback inside a MongoDB Replica Set ACID transaction,
 * retrying TransientTransactionError up to maxRetries times (api-spec §15.5).
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let attempt = 0;

  while (true) {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      if (isTransientTransactionError(err) && attempt < maxRetries) {
        attempt += 1;
        logger.warn({ attempt }, 'Retrying MongoDB TransientTransactionError');
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
