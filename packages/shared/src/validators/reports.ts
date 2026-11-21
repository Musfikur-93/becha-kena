import { z } from 'zod';

import { REPORT_REASONS, REPORT_TARGET_TYPES } from '../constants/enums.js';

import { objectIdSchema } from './primitives.js';

export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: objectIdSchema,
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().min(10).max(1000)
});

export type CreateReportDto = z.infer<typeof createReportSchema>;
