import { z } from 'zod';

import { bdPhoneSchema, otpCodeSchema } from './primitives.js';

export const createAppealSchema = z.object({
  phoneNumber: bdPhoneSchema,
  otpCode: otpCodeSchema,
  appealReason: z.string().trim().min(20).max(1000),
  contactEmailOrPhone: z.string().trim().min(5).max(120),
  evidenceKeys: z.array(z.string().trim().min(5).max(300)).max(5).default([])
});

export const appealUploadUrlsSchema = z.object({
  phoneNumber: bdPhoneSchema,
  otpCode: otpCodeSchema,
  mimeTypes: z
    .array(z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']))
    .min(1)
    .max(5)
});

export type CreateAppealDto = z.infer<typeof createAppealSchema>;
export type AppealUploadUrlsDto = z.infer<typeof appealUploadUrlsSchema>;
