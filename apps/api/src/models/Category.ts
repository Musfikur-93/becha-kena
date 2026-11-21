import { CATEGORY_ATTRIBUTE_TYPES, type CategoryAttributeType } from '@becha-kena/shared';
import { Schema, type Document, type Types } from 'mongoose';

import { getOrCreateModel } from './_helper.js';

export interface ICategoryAttribute {
  key: string;
  label: string;
  type: CategoryAttributeType;
  options?: string[];
  required: boolean;
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  parentId?: Types.ObjectId | null;
  level: 1 | 2 | 3;
  minPriceBDT: number;
  maxPriceBDT?: number | null;
  attributeSchema: ICategoryAttribute[];
  iconUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryAttributeSchema = new Schema<ICategoryAttribute>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: CATEGORY_ATTRIBUTE_TYPES, required: true },
    options: { type: [String], default: undefined },
    required: { type: Boolean, default: false }
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    level: { type: Number, enum: [1, 2, 3], required: true },
    minPriceBDT: { type: Number, required: true, default: 10, min: 0 },
    maxPriceBDT: { type: Number, default: null },
    attributeSchema: { type: [CategoryAttributeSchema], default: [] },
    iconUrl: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  {
    collection: 'categories',
    timestamps: true
  }
);

CategorySchema.index({ parentId: 1, sortOrder: 1 });

export const Category = getOrCreateModel<ICategory>('Category', CategorySchema);
