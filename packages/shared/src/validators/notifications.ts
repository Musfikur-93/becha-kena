import { z } from 'zod';

import { cursorSchema } from './primitives.js';

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
