import { z } from 'zod';

import { LIMITS } from '../constants/limits.js';

export const BD_PHONE_REGEX = /^\+8801[3-9]\d{8}$/;
export const OTP_REGEX = /^\d{6}$/;
export const NID_REGEX = /^(\d{10}|\d{13}|\d{17})$/;
export const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
export const PIN_REGEX = /^\d{4,6}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BENGALI_DIGITS[ch] ?? ch);
}

/**
 * Normalizes Bangladeshi mobile numbers into canonical E.164 (+8801[3-9]XXXXXXXX).
 * Accepts: 01711223344, 8801711223344, +8801711223344 (including spaces/hyphens/Bengali digits).
 */
export function normalizeBdPhone(raw: string): string {
  const ascii = toAsciiDigits(raw).trim().replace(/[\s\-()]/g, '');
  if (ascii.startsWith('+880')) {
    return ascii;
  }
  if (ascii.startsWith('880')) {
    return `+${ascii}`;
  }
  if (ascii.startsWith('01')) {
    return `+88${ascii}`;
  }
  return ascii;
}

export const bdPhoneSchema = z
  .string()
  .transform((val) => normalizeBdPhone(val))
  .refine((val) => BD_PHONE_REGEX.test(val), {
    message: 'Must be a valid Bangladeshi E.164 mobile number (+8801[3-9]XXXXXXXX).'
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(OTP_REGEX, 'OTP must be a 6-digit numeric code.');

export const nidNumberSchema = z
  .string()
  .trim()
  .transform((val) => toAsciiDigits(val).replace(/[\s-]/g, ''))
  .refine((val) => NID_REGEX.test(val), {
    message: 'NID must be 10, 13, or 17 digits.'
  });

export const objectIdSchema = z
  .string()
  .trim()
  .regex(OBJECT_ID_REGEX, 'Invalid ObjectId format.');

export const pinSchema = z
  .string()
  .trim()
  .regex(PIN_REGEX, 'Account PIN must be 4 to 6 digits.');

export const uuidV4Schema = z.string().uuid('Must be a valid UUID.');

export const cursorSchema = z.string().min(1).max(512).optional();

export const bdLatitudeSchema = z
  .number()
  .min(
    LIMITS.BD_BOUNDS.LAT_MIN,
    `Latitude must be within Bangladesh bounds [${LIMITS.BD_BOUNDS.LAT_MIN}, ${LIMITS.BD_BOUNDS.LAT_MAX}].`
  )
  .max(
    LIMITS.BD_BOUNDS.LAT_MAX,
    `Latitude must be within Bangladesh bounds [${LIMITS.BD_BOUNDS.LAT_MIN}, ${LIMITS.BD_BOUNDS.LAT_MAX}].`
  );

export const bdLongitudeSchema = z
  .number()
  .min(
    LIMITS.BD_BOUNDS.LNG_MIN,
    `Longitude must be within Bangladesh bounds [${LIMITS.BD_BOUNDS.LNG_MIN}, ${LIMITS.BD_BOUNDS.LNG_MAX}].`
  )
  .max(
    LIMITS.BD_BOUNDS.LNG_MAX,
    `Longitude must be within Bangladesh bounds [${LIMITS.BD_BOUNDS.LNG_MIN}, ${LIMITS.BD_BOUNDS.LNG_MAX}].`
  );

export const geoPointInputSchema = z.object({
  longitude: bdLongitudeSchema,
  latitude: bdLatitudeSchema
});

export const manualAddressSchema = z.object({
  division: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  thana: z.string().trim().min(2).max(80)
});

export const isoDateSchema = z
  .string()
  .trim()
  .regex(ISO_DATE_REGEX, 'Date must be in YYYY-MM-DD format.');
