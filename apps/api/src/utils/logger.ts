import pino, { type DestinationStream } from 'pino';

import { config } from '../config/env.js';

const PRESIGNED_PARAM_REGEX =
  /([?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token)=)[^&\s"']+/gi;

export function scrubPresignedTokens(input: string): string {
  return input.replace(PRESIGNED_PARAM_REGEX, '$1[REDACTED]');
}

export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-admin-totp"]',
  'res.headers["set-cookie"]',
  '*.cookie',
  '*.authorization',
  '*.phoneNumber',
  '*.contactPhone',
  '*.phoneRevealed',
  '*.nidNumber',
  '*.canonicalNidHash',
  '*.otpCode',
  '*.pin',
  '*.accountPin',
  '*.accountPinHash',
  '*.storageKeys',
  '*.porichoyResponse',
  'phoneNumber',
  'contactPhone',
  'nidNumber',
  'otpCode',
  'pin',
  'storageKeys'
];

export function createLogger(destination?: DestinationStream): pino.Logger {
  return pino(
    {
      level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL,
      redact: {
        paths: LOG_REDACT_PATHS,
        censor: '[REDACTED]'
      },
      formatters: {
        log(obj) {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            out[k] = typeof v === 'string' ? scrubPresignedTokens(v) : v;
          }
          return out;
        }
      }
    },
    destination
  );
}

export const logger = createLogger();
