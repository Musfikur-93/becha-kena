import { z } from 'zod';

import { GUARDIAN_RELATIONSHIPS, VERIFICATION_TYPES } from '../constants/enums.js';

import { isoDateSchema, nidNumberSchema } from './primitives.js';

const allowedKycMimeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

export const kycUploadUrlsSchema = z.object({
  files: z.object({
    frontMimeType: allowedKycMimeSchema,
    backMimeType: allowedKycMimeSchema,
    selfieMimeType: allowedKycMimeSchema
  })
});

export const kycStorageKeysSchema = z.object({
  frontKey: z.string().trim().min(5).max(300),
  backKey: z.string().trim().min(5).max(300),
  selfieKey: z.string().trim().min(5).max(300)
});

export const kycSubmitSchema = z
  .object({
    verificationType: z.enum(VERIFICATION_TYPES),
    nidNumber: nidNumberSchema,
    fullName: z.string().trim().min(2).max(120),
    dob: isoDateSchema,
    sellerDob: isoDateSchema.optional(),
    guardianName: z.string().trim().min(2).max(120).nullable().optional(),
    guardianRelationship: z.enum(GUARDIAN_RELATIONSHIPS).nullable().optional(),
    storageKeys: kycStorageKeysSchema
  })
  .superRefine((data, ctx) => {
    if (data.verificationType === 'MINOR_GUARDIAN') {
      if (!data.guardianName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianName'],
          message: 'Guardian name is required for MINOR_GUARDIAN verification.'
        });
      }
      if (!data.guardianRelationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianRelationship'],
          message: 'Guardian relationship is required for MINOR_GUARDIAN verification.'
        });
      }
    }
  });

export const kycUpgradeAdultSchema = z.object({
  nidNumber: nidNumberSchema,
  fullName: z.string().trim().min(2).max(120),
  dob: isoDateSchema,
  storageKeys: kycStorageKeysSchema
});

export type KycUploadUrlsDto = z.infer<typeof kycUploadUrlsSchema>;
export type KycSubmitDto = z.infer<typeof kycSubmitSchema>;
export type KycUpgradeAdultDto = z.infer<typeof kycUpgradeAdultSchema>;
