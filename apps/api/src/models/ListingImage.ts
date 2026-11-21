import { LIMITS } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IListingImage extends Document {
  listingId?: Types.ObjectId | null;
  uploadedBy: Types.ObjectId;
  r2Key: string;
  cdnUrl: string;
  sortOrder: number;
  mimeType: 'image/webp';
  sizeBytes: number;
  exifStripped: boolean;
  ocrChecked: boolean;
  ocrFlagged: boolean;
  createdAt: Date;
}

const ListingImageSchema = new Schema<IListingImage>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    r2Key: { type: String, required: true, unique: true },
    cdnUrl: { type: String, required: true },
    sortOrder: { type: Number, required: true, min: 0, max: 9, default: 0 },
    mimeType: { type: String, enum: ['image/webp'], required: true, default: 'image/webp' },
    sizeBytes: { type: Number, required: true, max: LIMITS.WEBP_MAX_BYTES },
    exifStripped: { type: Boolean, required: true, default: true },
    ocrChecked: { type: Boolean, default: false },
    ocrFlagged: { type: Boolean, default: false }
  },
  {
    collection: 'listing_images',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

ListingImageSchema.index({ listingId: 1, sortOrder: 1 });
ListingImageSchema.index({ listingId: 1, createdAt: 1 });

export const ListingImage = getOrCreateModel<IListingImage>('ListingImage', ListingImageSchema);
