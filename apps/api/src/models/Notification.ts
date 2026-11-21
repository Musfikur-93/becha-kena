import { NOTIFICATION_TYPES, type NotificationType } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

/**
 * 14th Collection per Decision D-05 (PRD.md §6 Event & Notification Matrix):
 * Persists in-app notifications with a 90-day TTL.
 */
export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null }
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });
// 90-day auto-purge TTL index
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });

export const Notification = getOrCreateModel<INotification>('Notification', NotificationSchema);
