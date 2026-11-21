import { OFFER_STATUSES, type OfferStatus } from '@becha-kena/shared';
import { Schema, Types, type Document } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface ICurrentOffer {
  offerId: Types.ObjectId;
  amount: number;
  agreedPrice?: number | null;
  proposedBy: Types.ObjectId;
  status: OfferStatus;
  expiresAt: Date;
}

export interface IChatThread extends Document {
  listingId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  listingSnapshot: {
    title: string;
    price: number;
    thumbnail: string;
    status: string;
  };
  lastMessage?: {
    body: string;
    senderId: Types.ObjectId;
    createdAt: Date;
  } | null;
  unreadCountBuyer: number;
  unreadCountSeller: number;
  currentOffer?: ICurrentOffer | null;
  isLocked: boolean;
  lockReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatThreadSchema = new Schema<IChatThread>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingSnapshot: {
      title: { type: String, required: true },
      price: { type: Number, required: true },
      thumbnail: { type: String, required: true },
      status: { type: String, required: true }
    },
    lastMessage: {
      type: {
        body: { type: String, required: true },
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, required: true }
      },
      default: null,
      _id: false
    },
    unreadCountBuyer: { type: Number, default: 0, min: 0 },
    unreadCountSeller: { type: Number, default: 0, min: 0 },
    currentOffer: {
      type: {
        offerId: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
        amount: { type: Number, required: true },
        agreedPrice: { type: Number, default: null },
        proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
          type: String,
          enum: OFFER_STATUSES,
          default: 'pending'
        },
        expiresAt: { type: Date, required: true }
      },
      default: null,
      _id: false
    },
    isLocked: { type: Boolean, default: false },
    lockReason: { type: String, default: null }
  },
  {
    collection: 'chat_threads',
    timestamps: true
  }
);

ChatThreadSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
ChatThreadSchema.index({ buyerId: 1, updatedAt: -1 });
ChatThreadSchema.index({ sellerId: 1, updatedAt: -1 });

export const ChatThread = getOrCreateModel<IChatThread>('ChatThread', ChatThreadSchema);
