import {
  LIMITS,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  type ListingCondition,
  type ListingStatus
} from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IListingImageEmbedded {
  cdnUrl: string;
  r2Key: string;
  sortOrder: number;
  ocrFlagged: boolean;
}

export interface IListing extends Document {
  sellerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  title: string;
  description: string;
  condition: ListingCondition;
  price: number;
  isNegotiable: boolean;
  contactPhone: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address: {
    division: string;
    district: string;
    thana: string;
  };
  attributes: Map<string, unknown>;
  images: IListingImageEmbedded[];
  coverImageUrl: string;
  sellerSnapshot: {
    displayName: string;
    isSellerVerified: boolean;
    trustScore: number;
    avatarUrl?: string | null;
  };
  status: ListingStatus;
  viewsCount: number;
  reservedBuyerId?: Types.ObjectId | null;
  soldToBuyerId?: Types.ObjectId | null;
  soldPriceBDT?: number | null;
  soldAt?: Date | null;
  dealConfirmedByBuyer: boolean;
  dealConfirmedAt?: Date | null;
  dealDisputedAt?: Date | null;
  pendingRevision?: Record<string, unknown> | null;
  moderationEscalatedAt?: Date | null;
  expiryWarnedAt?: Date | null;
  expiresAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ListingImageEmbeddedSchema = new Schema<IListingImageEmbedded>(
  {
    cdnUrl: { type: String, required: true },
    r2Key: { type: String, required: true },
    sortOrder: { type: Number, required: true, min: 0, max: 9 },
    ocrFlagged: { type: Boolean, default: false }
  },
  { _id: false }
);

const ListingSchema = new Schema<IListing>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 100 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    condition: {
      type: String,
      enum: LISTING_CONDITIONS,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: LIMITS.PRICE_MAX_BDT,
      validate: {
        validator: function (this: IListing, val: number): boolean {
          if (this.condition === 'free') return val === 0;
          return val >= LIMITS.PRICE_MIN_BDT;
        },
        message: 'Price must be 0 for free items, or at least 10 BDT for priced listings.'
      }
    },
    isNegotiable: { type: Boolean, default: true },
    contactPhone: {
      type: String,
      required: true,
      match: [/^\+8801[3-9]\d{8}$/, 'Must be a valid E.164 Bangladeshi phone number.']
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: number[]) => coords.length === 2,
          message: 'GeoJSON Point coordinates must contain [longitude, latitude].'
        }
      }
    },
    address: {
      division: { type: String, required: true },
      district: { type: String, required: true },
      thana: { type: String, required: true }
    },
    attributes: { type: Map, of: Schema.Types.Mixed, default: {} },
    images: {
      type: [ListingImageEmbeddedSchema],
      required: true,
      validate: {
        validator: (arr: IListingImageEmbedded[]) =>
          arr.length >= LIMITS.IMAGES_MIN && arr.length <= LIMITS.IMAGES_MAX,
        message: `Listings require ${LIMITS.IMAGES_MIN} to ${LIMITS.IMAGES_MAX} images.`
      }
    },
    coverImageUrl: { type: String, required: true },
    sellerSnapshot: {
      displayName: { type: String, required: true },
      isSellerVerified: { type: Boolean, required: true },
      trustScore: { type: Number, required: true, min: 0, max: 5 },
      avatarUrl: { type: String, default: null }
    },
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: 'active'
    },
    viewsCount: { type: Number, default: 0, min: 0 },
    reservedBuyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    soldToBuyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    soldPriceBDT: { type: Number, default: null },
    soldAt: { type: Date, default: null },
    dealConfirmedByBuyer: { type: Boolean, default: false },
    dealConfirmedAt: { type: Date, default: null },
    dealDisputedAt: { type: Date, default: null },
    pendingRevision: { type: Schema.Types.Mixed, default: null },
    moderationEscalatedAt: { type: Date, default: null },
    expiryWarnedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null }
  },
  {
    collection: 'listings',
    timestamps: true,
    optimisticConcurrency: true
  }
);

ListingSchema.index({ location: '2dsphere' });
ListingSchema.index({ status: 1, categoryId: 1, createdAt: -1 });
ListingSchema.index({ sellerId: 1, status: 1 });
ListingSchema.index({ status: 1, expiresAt: 1 });

export const Listing = getOrCreateModel<IListing>('Listing', ListingSchema);
