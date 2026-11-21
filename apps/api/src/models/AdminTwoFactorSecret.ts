import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

/**
 * 13th Collection per Decision D-04 (architecture.md §5.7):
 * Stores AES-256-GCM encrypted TOTP secrets and recognized device IDs for staff accounts.
 */
export interface IAdminTwoFactorSecret extends Document {
  userId: Types.ObjectId;
  secretEncrypted: string;
  enabledAt?: Date | null;
  lastUsedAt?: Date | null;
  recognizedDeviceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AdminTwoFactorSecretSchema = new Schema<IAdminTwoFactorSecret>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    secretEncrypted: { type: String, required: true, select: false },
    enabledAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    recognizedDeviceIds: { type: [String], default: [] }
  },
  {
    collection: 'admin_2fa_secrets',
    timestamps: true
  }
);

export const AdminTwoFactorSecret = getOrCreateModel<IAdminTwoFactorSecret>(
  'AdminTwoFactorSecret',
  AdminTwoFactorSecretSchema
);
