import { z } from 'zod';

import { LISTING_CONDITIONS, SEARCH_SORTS } from '../constants/enums.js';
import { LIMITS } from '../constants/limits.js';

import { bdLatitudeSchema, bdLongitudeSchema, cursorSchema } from './primitives.js';

export const searchListingsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  categorySlug: z.string().trim().min(1).max(100).optional(),
  lat: z.coerce.number().pipe(bdLatitudeSchema).optional(),
  lng: z.coerce.number().pipe(bdLongitudeSchema).optional(),
  radiusKm: z.coerce
    .number()
    .refine(
      (v) => (LIMITS.RADIUS_TIERS_KM as readonly number[]).includes(v),
      'radiusKm must be one of 2, 5, 10, 25, or 0 (All Bangladesh).'
    )
    .default(10),
  division: z.string().trim().min(2).max(60).optional(),
  district: z.string().trim().min(2).max(60).optional(),
  thana: z.string().trim().min(2).max(80).optional(),
  condition: z.enum(LISTING_CONDITIONS).optional(),
  minPrice: z.coerce.number().min(0).max(LIMITS.PRICE_MAX_BDT).optional(),
  maxPrice: z.coerce.number().min(0).max(LIMITS.PRICE_MAX_BDT).optional(),
  attributes: z.string().max(1000).optional(),
  sort: z.enum(SEARCH_SORTS).default('nearest'),
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(40).default(20)
});

export const pdpQuerySchema = z.object({
  lat: z.coerce.number().pipe(bdLatitudeSchema).optional(),
  lng: z.coerce.number().pipe(bdLongitudeSchema).optional()
});

export const sellerDashboardQuerySchema = z.object({
  tab: z.enum(['active', 'under_review', 'reserved', 'sold', 'expired']).default('active'),
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(40).default(20)
});

export type SearchListingsQueryDto = z.infer<typeof searchListingsQuerySchema>;
export type PdpQueryDto = z.infer<typeof pdpQuerySchema>;
export type SellerDashboardQueryDto = z.infer<typeof sellerDashboardQuerySchema>;
