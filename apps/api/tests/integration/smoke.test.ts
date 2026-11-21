import mongoose, { Schema, model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db.js';

const SmokeSchema = new Schema({
  name: { type: String, required: true }
});
const SmokeModel = model('SmokeTest', SmokeSchema);

describe('Phase B00 Smoke Test (MongoMemoryReplSet + ACID Transactions)', () => {
  beforeAll(async () => {
    await connectTestDb();
    await SmokeModel.createCollection();
  });

  afterAll(async () => {
    await clearTestDb();
    await disconnectTestDb();
  });

  it('commits a MongoDB replica set transaction cleanly', async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await SmokeModel.create([{ name: 'becha-kena-smoke' }], { session });
      });
    } finally {
      await session.endSession();
    }

    const found = await SmokeModel.findOne({ name: 'becha-kena-smoke' }).lean();
    expect(found).not.toBeNull();
    expect(found?.name).toBe('becha-kena-smoke');
  });
});
