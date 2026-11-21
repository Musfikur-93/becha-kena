import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  type ApiErrorDetail,
  type ErrorCode
} from '@becha-kena/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];
  public readonly retryAfterSeconds?: number;
  public readonly isOperational = true;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ApiErrorDetail[],
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    Error.captureStackTrace(this, this.constructor);
  }

  static fromCode(
    code: ErrorCode,
    message: string,
    details?: ApiErrorDetail[],
    retryAfterSeconds?: number
  ): AppError {
    return new AppError(ERROR_HTTP_STATUS[code], code, message, details, retryAfterSeconds);
  }

  static badRequest(message: string, code: ErrorCode = ERROR_CODES.VALIDATION_ERROR, details?: ApiErrorDetail[]): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required.', code: ErrorCode = ERROR_CODES.UNAUTHORIZED): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action.', code: ErrorCode = ERROR_CODES.FORBIDDEN): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Requested resource not found.'): AppError {
    return new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, message);
  }

  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT_409): AppError {
    return new AppError(409, code, message);
  }

  static gone(message = 'This listing is no longer available.'): AppError {
    return new AppError(410, ERROR_CODES.LISTING_UNAVAILABLE, message);
  }

  static unprocessable(message: string, code: ErrorCode = ERROR_CODES.QUOTA_EXCEEDED, details?: ApiErrorDetail[]): AppError {
    return new AppError(422, code, message, details);
  }

  static rateLimited(message: string, retryAfterSeconds: number): AppError {
    return new AppError(429, ERROR_CODES.RATE_LIMIT_EXCEEDED, message, undefined, retryAfterSeconds);
  }
}
