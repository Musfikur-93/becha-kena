import { z } from 'zod';

import { LISTING_CONDITIONS } from '../constants/enums.js';
import { LIMITS } from '../constants/limits.js';

import { containsProhibitedContactOrUrl } from './contentGuards.js';
import {
  bdPhoneSchema,
  geoPointInputSchema,
  manualAddressSchema,
  objectIdSchema
} from './primitives.js';

export const listingImageInputSchema = z.object({
  imageId: objectIdSchema,
  cdnUrl: z.string().url(),
  r2Key: z.string().trim().min(3).max(300),
  sortOrder: z.number().int().min(0).max(9)
});

export const createListingSchema = z
  .object({
    categoryId: objectIdSchema,
    title: z
      .string()
      .trim()
      .min(5, 'Title must be at least 5 characters.')
      .max(100, 'Title must be at most 100 characters.')
      .refine((v) => !containsProhibitedContactOrUrl(v), {
        message: 'Listing title cannot contain phone numbers or website links (VAL-03).'
      }),
    description: z
      .string()
      .trim()
      .min(20, 'Description must be at least 20 characters.')
      .max(2000, 'Description must be at most 2,000 characters.')
      .refine((v) => !containsProhibitedContactOrUrl(v), {
        message: 'Listing description cannot contain phone numbers or website links (VAL-03).'
      }),
    condition: z.enum(LISTING_CONDITIONS),
    price: z.number().min(0).max(LIMITS.PRICE_MAX_BDT),
    isNegotiable: z.boolean().default(true),
    contactPhone: bdPhoneSchema.optional(),
    location: geoPointInputSchema.optional(),
    address: manualAddressSchema,
    attributes: z.record(z.string(), z.unknown()).default({}),
    images: z
      .array(listingImageInputSchema)
      .min(LIMITS.IMAGES_MIN, `Listings require at least ${LIMITS.IMAGES_MIN} images.`)
      .max(LIMITS.IMAGES_MAX, `Listings allow at most ${LIMITS.IMAGES_MAX} images.`)
  })
  .superRefine((data, ctx) => {
    if (data.condition === 'free') {
      if (data.price !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['price'],
          message: 'Free / Giveaway listings must have a price of strictly 0 BDT.'
        });
      }
    } else if (data.price < LIMITS.PRICE_MIN_BDT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: `Priced listings must be at least ${LIMITS.PRICE_MIN_BDT} BDT.`
      });
    }
  });

export const updateListingSchema = z
  .object({
    categoryId: objectIdSchema.optional(),
    title: z
      .string()
      .trim()
      .min(5)
      .max(100)
      .refine((v) => !containsProhibitedContactOrUrl(v), {
        message: 'Listing title cannot contain phone numbers or website links (VAL-03).'
      })
      .optional(),
    description: z
      .string()
      .trim()
      .min(20)
      .max(2000)
      .refine((v) => !containsProhibitedContactOrUrl(v), {
        message: 'Listing description cannot contain phone numbers or website links (VAL-03).'
      })
      .optional(),
    condition: z.enum(LISTING_CONDITIONS).optional(),
    price: z.number().min(0).max(LIMITS.PRICE_MAX_BDT).optional(),
    isNegotiable: z.boolean().optional(),
    contactPhone: bdPhoneSchema.optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    images: z
      .array(listingImageInputSchema)
      .min(LIMITS.IMAGES_MIN)
      .max(LIMITS.IMAGES_MAX)
      .optional()
  })
  .superRefine((data, ctx) => {
    if (data.condition === 'free' && data.price !== undefined && data.price !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Free / Giveaway listings must have a price of strictly 0 BDT.'
      });
    }
    if (
      data.condition !== undefined &&
      data.condition !== 'free' &&
      data.price !== undefined &&
      data.price < LIMITS.PRICE_MIN_BDT
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: `Priced listings must be at least ${LIMITS.PRICE_MIN_BDT} BDT.`
      });
    }
  });

export const markSoldSchema = z.object({
  buyerId: objectIdSchema,
  finalPriceBDT: z.number().min(0).max(LIMITS.PRICE_MAX_BDT).optional()
});

export const confirmPurchaseSchema = z.object({
  confirmed: z.boolean()
});

export type CreateListingDto = z.infer<typeof createListingSchema>;
export type UpdateListingDto = z.infer<typeof updateListingSchema>;
export type MarkSoldDto = z.infer<typeof markSoldSchema>;
export type ConfirmPurchaseDto = z.infer<typeof confirmPurchaseSchema>;
