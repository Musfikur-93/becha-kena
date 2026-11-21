import { LIMITS } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface IReview extends Document {
  listingId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  revieweeId: Types.ObjectId;
  rating: number;
  comment: string;
  dealConfirmedByBuyer: boolean;
  editableUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, minlength: 10, maxlength: 500, trim: true },
    dealConfirmedByBuyer: { type: Boolean, required: true, default: true },
    editableUntil: {
      type: Date,
      default: () => new Date(Date.now() + LIMITS.REVIEW_EDIT_HOURS * 60 * 60 * 1000)
    }
  },
  {
    collection: 'reviews',
    timestamps: true
  }
);

ReviewSchema.index({ listingId: 1, reviewerId: 1 }, { unique: true });
ReviewSchema.index({ revieweeId: 1, createdAt: -1 });

export const Review = getOrCreateModel<IReview>('Review', ReviewSchema);
