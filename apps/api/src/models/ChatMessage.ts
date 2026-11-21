import {
  MESSAGE_TYPES,
  MODERATION_FLAGS,
  type MessageType,
  type ModerationFlag
} from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IChatMessage extends Document {
  threadId: Types.ObjectId;
  clientMessageId: string;
  senderId: Types.ObjectId;
  type: MessageType;
  body: string;
  mediaUrl?: string | null;
  offerAmount?: number | null;
  moderationFlag: ModerationFlag;
  readAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'ChatThread', required: true },
    clientMessageId: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    body: { type: String, required: true, maxlength: 1000 },
    mediaUrl: { type: String, default: null },
    offerAmount: { type: Number, default: null },
    moderationFlag: {
      type: String,
      enum: MODERATION_FLAGS,
      default: 'CLEAN'
    },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null }
  },
  {
    collection: 'messages',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

ChatMessageSchema.index({ threadId: 1, clientMessageId: 1 }, { unique: true });
ChatMessageSchema.index({ threadId: 1, createdAt: -1 });

export const ChatMessage = getOrCreateModel<IChatMessage>('ChatMessage', ChatMessageSchema);
