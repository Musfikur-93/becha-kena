import { ERROR_CODES } from '@becha-kena/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getTurnstileVerifier } from '../../adapters/turnstile/index.js';
import { AppError } from '../../utils/AppError.js';

export const requireTurnstile: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers['x-turnstile-token'];
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw AppError.badRequest(
        'Bot verification token is required.',
        ERROR_CODES.VALIDATION_ERROR,
        [
          {
            field: 'X-Turnstile-Token',
            code: 'REQUIRED',
            message: 'Missing X-Turnstile-Token header.'
          }
        ]
      );
    }

    const valid = await getTurnstileVerifier().verify(token.trim(), req.ip);
    if (!valid) {
      throw AppError.badRequest(
        'Bot verification failed. Please retry.',
        ERROR_CODES.VALIDATION_ERROR,
        [
          {
            field: 'X-Turnstile-Token',
            code: 'INVALID_TURNSTILE_TOKEN',
            message: 'Turnstile challenge verification failed.'
          }
        ]
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};
