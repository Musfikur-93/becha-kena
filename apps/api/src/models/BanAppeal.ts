import { APPEAL_STATUSES, type AppealStatus } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IBanAppeal extends Document {
  userId: Types.ObjectId;
  appealReason: string;
  contactEmailOrPhone: string;
  evidenceKeys: string[];
  status: AppealStatus;
  reviewedByAdminId?: Types.ObjectId | null;
  reviewNote?: string | null;
  submittedAt: Date;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BanAppealSchema = new Schema<IBanAppeal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appealReason: { type: String, required: true, minlength: 20, maxlength: 1000 },
    contactEmailOrPhone: { type: String, required: true },
    evidenceKeys: { type: [String], default: [] },
    status: {
      type: String,
      enum: APPEAL_STATUSES,
      default: 'pending'
    },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: null },
    submittedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null }
  },
  {
    collection: 'ban_appeals',
    timestamps: true
  }
);

BanAppealSchema.index({ status: 1, submittedAt: 1 });

export const BanAppeal = getOrCreateModel<IBanAppeal>('BanAppeal', BanAppealSchema);
