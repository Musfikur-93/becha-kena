import { z } from 'zod';

import { containsProhibitedContactOrUrl } from './contentGuards.js';
import { geoPointInputSchema, manualAddressSchema, pinSchema } from './primitives.js';

export const notificationPrefsSchema = z.object({
  newMessage: z.boolean().optional(),
  offerUpdates: z.boolean().optional(),
  listingExpiry: z.boolean().optional(),
  dealConfirmation: z.boolean().optional()
});

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .refine((v) => !containsProhibitedContactOrUrl(v), {
      message: 'Display name cannot contain phone numbers or URLs.'
    })
    .optional(),
  bio: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !containsProhibitedContactOrUrl(v), {
      message: 'Bio cannot contain phone numbers or URLs.'
    })
    .optional(),
  businessName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((v) => !containsProhibitedContactOrUrl(v), {
      message: 'Business name cannot contain phone numbers or URLs.'
    })
    .nullable()
    .optional(),
  avatarUrl: z.string().url().nullable().optional(),
  manualLocation: manualAddressSchema.optional(),
  location: geoPointInputSchema.optional(),
  fcmToken: z.string().trim().min(10).max(500).nullable().optional(),
  notificationPrefs: notificationPrefsSchema.optional(),
  accountPin: pinSchema.optional()
});

export const deleteAccountSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirmDelete: z.literal(true, {
    errorMap: () => ({ message: 'confirmDelete must be true to delete account.' })
  })
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
