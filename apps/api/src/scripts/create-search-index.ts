import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import { config } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../config/mongo.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  if (config.SEARCH_PROVIDER !== 'atlas') {
    logger.info('SEARCH_PROVIDER is not "atlas"; skipping Atlas Search index creation.');
    return;
  }

  await connectMongo();
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database handle not connected');

    const raw = fs.readFileSync(path.join(__dirname, 'atlas-search-index.json'), 'utf-8');
    const spec = JSON.parse(raw) as { name: string; definition: Record<string, unknown> };

    const collection = db.collection('listings');
    const existing = await collection.listSearchIndexes(spec.name).toArray();
    if (existing.length === 0) {
      await collection.createSearchIndex(spec);
      logger.info({ indexName: spec.name }, 'Created MongoDB Atlas Search index');
    } else {
      await collection.updateSearchIndex(spec.name, spec.definition);
      logger.info({ indexName: spec.name }, 'Updated MongoDB Atlas Search index');
    }
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  logger.error({ err }, 'Atlas Search index creation failed');
  process.exit(1);
});
