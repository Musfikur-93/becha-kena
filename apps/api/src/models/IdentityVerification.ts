import {
  GUARDIAN_RELATIONSHIPS,
  KYC_STATUSES,
  VERIFICATION_TYPES,
  type GuardianRelationship,
  type KycStatus,
  type VerificationType
} from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IIdentityVerification extends Document {
  userId: Types.ObjectId;
  verificationType: VerificationType;
  status: KycStatus;
  canonicalNidHash: string;
  compositeDobHash: string;
  guardianCanonicalNidHash?: string | null;
  guardianName?: string | null;
  guardianRelationship?: GuardianRelationship | null;
  storageKeys: {
    frontKey: string;
    backKey: string;
    selfieKey: string;
  };
  porichoyRefId?: string | null;
  porichoyResponse?: string | Record<string, unknown> | null;
  livenessScore: number;
  rejectionReason?: string | null;
  reviewedByAdminId?: Types.ObjectId | null;
  reviewNote?: string | null;
  submittedAt: Date;
  verifiedAt?: Date | null;
  supersededAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IdentityVerificationSchema = new Schema<IIdentityVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    verificationType: { type: String, enum: VERIFICATION_TYPES, required: true },
    status: {
      type: String,
      enum: KYC_STATUSES,
      default: 'pending'
    },
    canonicalNidHash: { type: String, required: true, select: false },
    compositeDobHash: { type: String, required: true, select: false },
    guardianCanonicalNidHash: { type: String, default: null, select: false },
    guardianName: { type: String, default: null },
    guardianRelationship: {
      type: String,
      enum: [...GUARDIAN_RELATIONSHIPS, null],
      default: null
    },
    storageKeys: {
      frontKey: { type: String, required: true, select: false },
      backKey: { type: String, required: true, select: false },
      selfieKey: { type: String, required: true, select: false }
    },
    porichoyRefId: { type: String, default: null, select: false },
    porichoyResponse: { type: Schema.Types.Mixed, default: null, select: false },
    livenessScore: { type: Number, default: 0, min: 0, max: 100 },
    rejectionReason: { type: String, default: null },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: null },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    supersededAt: { type: Date, default: null }
  },
  {
    collection: 'identity_verifications',
    timestamps: true
  }
);

IdentityVerificationSchema.index(
  { canonicalNidHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      verificationType: 'ADULT_SELF',
      status: 'verified'
    }
  }
);
IdentityVerificationSchema.index({ guardianCanonicalNidHash: 1, status: 1 }, { sparse: true });
IdentityVerificationSchema.index({ status: 1, createdAt: 1 });

export const IdentityVerification = getOrCreateModel<IIdentityVerification>(
  'IdentityVerification',
  IdentityVerificationSchema
);
