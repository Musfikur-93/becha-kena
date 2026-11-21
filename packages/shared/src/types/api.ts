import type { ErrorCode } from '../constants/errorCodes.js';

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  expandedRadiusKm?: number | null;
  unreadCount?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    requestId: string;
    timestamp: string;
    retryAfterSeconds?: number;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;
