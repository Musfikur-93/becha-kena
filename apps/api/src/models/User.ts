import {
  KYC_STATUSES,
  LIMITS,
  USER_ROLES,
  USER_STATUSES,
  type KycStatus,
  type UserRole,
  type UserStatus
} from '@becha-kena/shared';
import { Schema, type Document } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IUser extends Document {
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  phoneVerified: boolean;
  accountPinHash?: string | null;
  activeListingCount: number;
  trustScore: number;
  completedDealsCount: number;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  manualLocation?: {
    division?: string;
    district?: string;
    thana?: string;
  };
  sellerProfile: {
    displayName?: string;
    bio?: string;
    businessName?: string | null;
    avatarUrl?: string | null;
    kycStatus: KycStatus;
    isSellerVerified: boolean;
    verifiedAt?: Date | null;
  };
  deviceIds: string[];
  fcmToken?: string | null;
  notificationPrefs: {
    newMessage: boolean;
    offerUpdates: boolean;
    listingExpiry: boolean;
    dealConfirmation: boolean;
  };
  bannedAt?: Date | null;
  banReason?: string | null;
  lastActiveAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserGeoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^\+8801[3-9]\d{8}$/, 'Must be a valid Bangladeshi E.164 phone number.']
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'USER'
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'active'
    },
    phoneVerified: { type: Boolean, default: true },
    accountPinHash: { type: String, default: null, select: false },
    activeListingCount: { type: Number, default: 0, min: 0, max: LIMITS.LISTING_QUOTA },
    trustScore: {
      type: Number,
      default: 0.0,
      min: LIMITS.TRUST_SCORE_MIN,
      max: LIMITS.TRUST_SCORE_MAX
    },
    completedDealsCount: { type: Number, default: 0, min: 0 },
    location: {
      type: UserGeoPointSchema,
      default: undefined
    },
    manualLocation: {
      division: { type: String },
      district: { type: String },
      thana: { type: String }
    },
    sellerProfile: {
      displayName: { type: String, trim: true, minlength: 3, maxlength: 50 },
      bio: { type: String, trim: true, maxlength: 500 },
      businessName: { type: String, trim: true, default: null },
      avatarUrl: { type: String, default: null },
      kycStatus: {
        type: String,
        enum: KYC_STATUSES,
        default: 'pending'
      },
      isSellerVerified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null }
    },
    deviceIds: { type: [String], default: [] },
    fcmToken: { type: String, default: null },
    notificationPrefs: {
      newMessage: { type: Boolean, default: true },
      offerUpdates: { type: Boolean, default: true },
      listingExpiry: { type: Boolean, default: true },
      dealConfirmation: { type: Boolean, default: true }
    },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null }
  },
  {
    collection: 'users',
    timestamps: true
  }
);

UserSchema.index({ status: 1, lastActiveAt: -1 });
UserSchema.index({ 'sellerProfile.kycStatus': 1, createdAt: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ location: '2dsphere' }, { sparse: true });

export const User = getOrCreateModel<IUser>('User', UserSchema);
