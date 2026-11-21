import { AUDIT_TARGET_TYPES, type AuditTargetType } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IAdminAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetType: AuditTargetType;
  targetId: Types.ObjectId;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string | null;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: AUDIT_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    details: { type: Schema.Types.Mixed, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: null }
  },
  {
    collection: 'admin_audit_logs',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetId: 1, targetType: 1 });

function rejectUpdate(): never {
  throw new Error('IMMUTABLE_AUDIT_LOG: Audit log records cannot be updated.');
}

function rejectDelete(): never {
  throw new Error('IMMUTABLE_AUDIT_LOG: Audit log records cannot be deleted.');
}

AdminAuditLogSchema.pre('updateOne', rejectUpdate);
AdminAuditLogSchema.pre('updateMany', rejectUpdate);
AdminAuditLogSchema.pre('findOneAndUpdate', rejectUpdate);
AdminAuditLogSchema.pre('replaceOne', rejectUpdate);
AdminAuditLogSchema.pre('deleteOne', rejectDelete);
AdminAuditLogSchema.pre('deleteMany', rejectDelete);
AdminAuditLogSchema.pre('findOneAndDelete', rejectDelete);

export const AdminAuditLog = getOrCreateModel<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
