import type { ApiSuccess, PaginationMeta } from '@becha-kena/shared';
import type { Response } from 'express';

export function ok<T>(
  res: Response,
  data: T,
  meta?: PaginationMeta,
  statusCode = 200
): Response<ApiSuccess<T>> {
  const payload: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(statusCode).json(payload);
}

export function created<T>(res: Response, data: T): Response<ApiSuccess<T>> {
  return ok(res, data, undefined, 201);
}
