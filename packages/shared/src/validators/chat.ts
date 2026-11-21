import { z } from 'zod';

import { LIMITS } from '../constants/limits.js';

import { cursorSchema, objectIdSchema, uuidV4Schema } from './primitives.js';

export const createChatThreadSchema = z.object({
  listingId: objectIdSchema
});

export const listChatThreadsQuerySchema = z.object({
  role: z.enum(['buying', 'selling', 'all']).default('all'),
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(40).default(20)
});

export const listChatMessagesQuerySchema = z.object({
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

export const sendMessageSchema = z
  .object({
    clientMessageId: uuidV4Schema,
    type: z.enum(['TEXT', 'IMAGE', 'OFFER']).default('TEXT'),
    body: z.string().trim().min(1).max(1000),
    mediaUrl: z.string().url().nullable().optional(),
    offerAmount: z.number().min(1).max(LIMITS.PRICE_MAX_BDT).nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (data.type === 'IMAGE' && !data.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mediaUrl'],
        message: 'mediaUrl is required when message type is IMAGE.'
      });
    }
    if (data.type === 'OFFER' && (data.offerAmount === undefined || data.offerAmount === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offerAmount'],
        message: 'offerAmount is required when message type is OFFER.'
      });
    }
  });

export const respondToOfferSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('ACCEPT'),
    expectedListingVersion: z.number().int().min(0),
    counterAmount: z.null().optional()
  }),
  z.object({
    action: z.literal('REJECT'),
    expectedListingVersion: z.number().int().min(0).optional(),
    counterAmount: z.null().optional()
  }),
  z.object({
    action: z.literal('COUNTER'),
    expectedListingVersion: z.number().int().min(0).optional(),
    counterAmount: z.number().min(1).max(LIMITS.PRICE_MAX_BDT)
  })
]);

export type CreateChatThreadDto = z.infer<typeof createChatThreadSchema>;
export type ListChatThreadsQueryDto = z.infer<typeof listChatThreadsQuerySchema>;
export type ListChatMessagesQueryDto = z.infer<typeof listChatMessagesQuerySchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type RespondToOfferDto = z.infer<typeof respondToOfferSchema>;
