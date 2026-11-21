import { z } from 'zod';

import { OTP_INTENTS } from '../constants/enums.js';

import {
  bdPhoneSchema,
  isoDateSchema,
  nidNumberSchema,
  otpCodeSchema,
  pinSchema
} from './primitives.js';

export const otpRequestSchema = z.object({
  phoneNumber: bdPhoneSchema,
  intent: z.enum(OTP_INTENTS).default('LOGIN_OR_REGISTER')
});

export const otpVerifySchema = z.object({
  phoneNumber: bdPhoneSchema,
  otpCode: otpCodeSchema,
  returnTo: z.string().max(200).optional()
});

export const logoutSchema = z.object({
  allDevices: z.boolean().default(false)
});

export const pinVerifySchema = z.object({
  pin: pinSchema
});

export const phoneMigrationSchema = z.object({
  oldPhoneNumber: bdPhoneSchema,
  nidNumber: nidNumberSchema,
  dob: isoDateSchema,
  selfieKey: z.string().trim().min(5).max(300)
});

export type OtpRequestDto = z.infer<typeof otpRequestSchema>;
export type OtpVerifyDto = z.infer<typeof otpVerifySchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;
export type PinVerifyDto = z.infer<typeof pinVerifySchema>;
export type PhoneMigrationDto = z.infer<typeof phoneMigrationSchema>;
