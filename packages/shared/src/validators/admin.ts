import { z } from 'zod';

import { REPORT_STATUSES } from '../constants/enums.js';
import { LIMITS } from '../constants/limits.js';

import { cursorSchema, objectIdSchema, otpCodeSchema } from './primitives.js';

export const adminTotpConfirmSchema = z.object({
  code: otpCodeSchema
});

export const adminKycDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reviewNote: z.string().trim().min(5).max(1000),
    rejectionReason: z.string().trim().min(3).max(200).nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECT' && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'rejectionReason is required when rejecting KYC.'
      });
    }
  });

export const adminReportsQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const adminReportActionSchema = z.object({
  status: z.enum(['investigating', 'resolved', 'dismissed']),
  actionTaken: z
    .enum([
      'NONE',
      'WARN_USER',
      'REMOVE_LISTING',
      'REMOVE_LISTING_AND_WARN_USER',
      'SUSPEND_USER',
      'ESCALATE_TO_LEAD'
    ])
    .default('NONE'),
  resolutionNote: z.string().trim().min(5).max(1000)
});

export const adminListingModerationDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(5).max(1000)
});

export const adminAppealDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().trim().min(5).max(1000)
});

export const adminBanUserSchema = z.object({
  banReason: z.string().trim().min(5).max(200),
  blacklistCanonicalNid: z.boolean().default(true),
  blacklistDeviceIds: z.boolean().default(true),
  internalEvidenceNote: z.string().trim().min(5).max(1000)
});

export const adminWarrantExportSchema = z.object({
  targetUserId: objectIdSchema,
  warrantReferenceNumber: z.string().trim().min(3).max(120),
  issuingAuthority: z.string().trim().min(3).max(200),
  includeKycImages: z.boolean().default(false)
});

export const adminUpdateCategorySchema = z.object({
  minPriceBDT: z.number().min(0).max(LIMITS.PRICE_MAX_BDT).optional(),
  maxPriceBDT: z.number().min(0).max(LIMITS.PRICE_MAX_BDT).nullable().optional(),
  isActive: z.boolean().optional()
});

export type AdminTotpConfirmDto = z.infer<typeof adminTotpConfirmSchema>;
export type AdminKycDecisionDto = z.infer<typeof adminKycDecisionSchema>;
export type AdminReportsQueryDto = z.infer<typeof adminReportsQuerySchema>;
export type AdminReportActionDto = z.infer<typeof adminReportActionSchema>;
export type AdminListingModerationDecisionDto = z.infer<
  typeof adminListingModerationDecisionSchema
>;
export type AdminAppealDecisionDto = z.infer<typeof adminAppealDecisionSchema>;
export type AdminBanUserDto = z.infer<typeof adminBanUserSchema>;
export type AdminWarrantExportDto = z.infer<typeof adminWarrantExportSchema>;
export type AdminUpdateCategoryDto = z.infer<typeof adminUpdateCategorySchema>;
