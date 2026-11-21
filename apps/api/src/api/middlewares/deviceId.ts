import { ERROR_CODES } from '@becha-kena/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../../utils/AppError.js';

export const requireDeviceId: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const header = req.headers['x-device-id'];
  if (typeof header !== 'string' || header.trim().length < 4 || header.trim().length > 128) {
    next(
      AppError.badRequest(
        'X-Device-Id header is required for this endpoint.',
        ERROR_CODES.VALIDATION_ERROR,
        [
          {
            field: 'X-Device-Id',
            code: 'REQUIRED',
            message: 'Missing or invalid X-Device-Id header (4-128 chars).'
          }
        ]
      )
    );
    return;
  }

  req.deviceId = header.trim();
  next();
};
