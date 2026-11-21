import { ERROR_CODES, type ApiErrorResponse } from '@becha-kena/shared';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'req_unknown';
  const timestamp = new Date().toISOString();

  // 1. Zod Validation Errors (400)
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Request validation failed on ${err.issues.length} field(s).`,
        requestId,
        timestamp,
        details: err.issues.map((issue) => ({
          field: issue.path.join('.') || undefined,
          code: issue.code.toUpperCase(),
          message: issue.message
        }))
      }
    });
    return;
  }

  // 2. Operational Domain Errors (AppError)
  if (err instanceof AppError) {
    if (err.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        timestamp,
        ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  // 3. Mongoose CastError (invalid ObjectId etc. -> 400)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Invalid value for field '${err.path}'.`,
        requestId,
        timestamp,
        details: [
          {
            field: err.path,
            code: 'INVALID_TYPE',
            message: `Invalid value for '${err.path}'.`
          }
        ]
      }
    });
    return;
  }

  // 4. MongoDB Duplicate Key Error (E11000 -> 409)
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  ) {
    res.status(409).json({
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_SUBMISSION,
        message: 'A record with these unique attributes already exists.',
        requestId,
        timestamp
      }
    });
    return;
  }

  // 5. Fallback: Unhandled / Programming Errors (masked in response)
  logger.error(
    { err, requestId, path: req.originalUrl, method: req.method },
    'Unhandled API exception'
  );

  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      requestId,
      timestamp
    }
  });
}
