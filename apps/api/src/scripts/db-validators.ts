import 'dotenv/config';
import mongoose from 'mongoose';

import { connectMongo, disconnectMongo } from '../config/mongo.js';
import { logger } from '../utils/logger.js';

export const LISTINGS_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'sellerId',
      'categoryId',
      'title',
      'description',
      'condition',
      'price',
      'contactPhone',
      'location',
      'images',
      'status',
      'expiresAt'
    ],
    properties: {
      title: {
        bsonType: 'string',
        minLength: 5,
        maxLength: 100
      },
      description: {
        bsonType: 'string',
        minLength: 20,
        maxLength: 2000
      },
      condition: {
        enum: ['new', 'used_like_new', 'used_good', 'used_fair', 'free']
      },
      price: {
        bsonType: ['int', 'long', 'double', 'decimal'],
        minimum: 0,
        maximum: 100000000
      },
      contactPhone: {
        bsonType: 'string',
        pattern: '^\\+8801[3-9]\\d{8}$'
      },
      images: {
        bsonType: 'array',
        minItems: 1,
        maxItems: 10
      },
      location: {
        bsonType: 'object',
        required: ['type', 'coordinates'],
        properties: {
          type: { enum: ['Point'] },
          coordinates: {
            bsonType: 'array',
            minItems: 2,
            maxItems: 2,
            items: { bsonType: ['double', 'int', 'long', 'decimal'] }
          }
        }
      },
      status: {
        enum: ['draft', 'active', 'under_review', 'reserved', 'sold', 'expired', 'deleted']
      }
    }
  }
};

export async function applyDbValidators(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB database handle is not connected.');
  }

  const existing = await db.listCollections({ name: 'listings' }).toArray();
  if (existing.length === 0) {
    await db.createCollection('listings', {
      validator: LISTINGS_JSON_SCHEMA,
      validationLevel: 'moderate',
      validationAction: 'error'
    });
    logger.info('Created listings collection with $jsonSchema validator');
  } else {
    await db.command({
      collMod: 'listings',
      validator: LISTINGS_JSON_SCHEMA,
      validationLevel: 'moderate',
      validationAction: 'error'
    });
    logger.info('Updated listings collection $jsonSchema validator');
  }
}

async function main(): Promise<void> {
  await connectMongo();
  try {
    await applyDbValidators();
  } finally {
    await disconnectMongo();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((err) => {
    logger.error({ err }, 'DB validator application failed');
    process.exit(1);
  });
}
