import {
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType
} from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: ReportReason;
  description: string;
  evidenceSnapshot?: Record<string, unknown> | null;
  evidenceExpiresAt?: Date | null;
  status: ReportStatus;
  assignedAdminId?: Types.ObjectId | null;
  resolutionNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, required: true, maxlength: 1000 },
    evidenceSnapshot: { type: Schema.Types.Mixed, default: null },
    evidenceExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open'
    },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: null }
  },
  {
    collection: 'reports',
    timestamps: true
  }
);

ReportSchema.index({ reporterId: 1, targetId: 1 }, { unique: true });
ReportSchema.index({ status: 1, createdAt: 1 });
ReportSchema.index({ targetType: 1, targetId: 1, status: 1 });

export const Report = getOrCreateModel<IReport>('Report', ReportSchema);
