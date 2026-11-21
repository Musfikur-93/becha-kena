import 'dotenv/config';

import { connectMongo, disconnectMongo } from '../config/mongo.js';
import {
  AdminAuditLog,
  AdminTwoFactorSecret,
  BanAppeal,
  Category,
  ChatMessage,
  ChatThread,
  IdentityVerification,
  Listing,
  ListingImage,
  Notification,
  PhoneRevealLog,
  Report,
  Review,
  User
} from '../models/index.js';
import { logger } from '../utils/logger.js';

const ALL_MODELS = [
  User,
  IdentityVerification,
  Category,
  Listing,
  ListingImage,
  PhoneRevealLog,
  ChatThread,
  ChatMessage,
  Review,
  Report,
  BanAppeal,
  AdminAuditLog,
  AdminTwoFactorSecret,
  Notification
];

export async function syncAllIndexes(): Promise<void> {
  for (const m of ALL_MODELS) {
    const dropped = await m.syncIndexes();
    logger.info({ model: m.modelName, dropped }, 'Synced model indexes');
  }
}

async function main(): Promise<void> {
  await connectMongo();
  try {
    await syncAllIndexes();
  } finally {
    await disconnectMongo();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((err) => {
    logger.error({ err }, 'Index sync failed');
    process.exit(1);
  });
}
