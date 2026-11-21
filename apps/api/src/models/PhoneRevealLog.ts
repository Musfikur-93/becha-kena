import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IPhoneRevealLog extends Document {
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  phoneRevealed: string;
  ipAddress: string;
  deviceId?: string | null;
  revealedAt: Date;
}

const PhoneRevealLogSchema = new Schema<IPhoneRevealLog>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    phoneRevealed: { type: String, required: true, select: false },
    ipAddress: { type: String, required: true, select: false },
    deviceId: { type: String, default: null },
    revealedAt: { type: Date, default: Date.now, required: true }
  },
  {
    collection: 'phone_reveal_logs',
    timestamps: false
  }
);

PhoneRevealLogSchema.index({ buyerId: 1, listingId: 1, revealedAt: -1 });
// 90-day compliance auto-purge TTL index (7,776,000 seconds)
PhoneRevealLogSchema.index({ revealedAt: 1 }, { expireAfterSeconds: 7_776_000 });

export const PhoneRevealLog = getOrCreateModel<IPhoneRevealLog>('PhoneRevealLog', PhoneRevealLogSchema);
