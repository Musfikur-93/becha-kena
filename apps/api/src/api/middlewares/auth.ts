import {
  ERROR_CODES,
  hasRoleAtLeast,
  type StaffRole,
  type UserRole
} from '@becha-kena/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getRedis } from '../../config/redis.js';
import { userRepository } from '../../repositories/index.js';
import { ACCESS_COOKIE_NAME, verifyAccessToken } from '../../services/token.service.js';
import { AppError } from '../../utils/AppError.js';

async function resolveUserFromRequest(req: Request): Promise<void> {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    throw AppError.unauthorized('Authentication required.');
  }

  const payload = verifyAccessToken(token);
  const redis = getRedis();

  const isBanned = await redis.sismember('banned_users', payload.userId);
  if (isBanned) {
    throw AppError.forbidden(
      'This account has been suspended or banned.',
      ERROR_CODES.ACCOUNT_SUSPENDED_OR_BANNED
    );
  }

  req.user = {
    id: payload.userId,
    role: payload.role,
    isSellerVerified: payload.isSellerVerified,
    deviceId: payload.deviceId
  };
}

export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await resolveUserFromRequest(req);
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    await resolveUserFromRequest(req);
    next();
  } catch (err) {
    // Only propagate explicit ban errors; treat expired/invalid optional cookies as guest
    if (err instanceof AppError && err.code === ERROR_CODES.ACCOUNT_SUSPENDED_OR_BANNED) {
      next(err);
      return;
    }
    next();
  }
};

export const requireVerifiedSeller: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required.');
    }

    const redis = getRedis();
    const cacheKey = `seller_verified:${req.user.id}`;
    const cached = await redis.get(cacheKey);

    let isVerified: boolean;
    if (cached === '1' || cached === '0') {
      isVerified = cached === '1';
    } else {
      const user = await userRepository.findById(req.user.id);
      if (!user || user.status !== 'active') {
        throw AppError.forbidden(
          'Account is not active.',
          ERROR_CODES.ACCOUNT_SUSPENDED_OR_BANNED
        );
      }
      isVerified = user.sellerProfile.isSellerVerified;
      await redis.set(cacheKey, isVerified ? '1' : '0', 'EX', 60);
    }

    if (!isVerified) {
      throw AppError.forbidden(
        'Porichoy NID e-KYC verification is required to access seller features.',
        ERROR_CODES.FORBIDDEN_KYC_REQUIRED
      );
    }

    req.user.isSellerVerified = true;
    next();
  } catch (err) {
    next(err);
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('Insufficient role permissions for this endpoint.'));
      return;
    }
    next();
  };
}

export function requireStaff(minRole: StaffRole): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required.'));
      return;
    }
    if (!hasRoleAtLeast(req.user.role, minRole)) {
      next(AppError.forbidden(`Minimum staff role '${minRole}' is required.`));
      return;
    }
    next();
  };
}

export const requirePinIfDormant: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required.');
    }
    const deviceId = req.deviceId ?? req.user.deviceId ?? 'unknown';
    const redis = getRedis();
    const flag = await redis.get(`pin_required:${req.user.id}:${deviceId}`);
    if (flag === '1') {
      throw AppError.unauthorized(
        'Account security PIN verification is required on this new device.',
        ERROR_CODES.PIN_VERIFICATION_REQUIRED
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const guards = {
  public: [] as RequestHandler[],
  user: [authenticate] as RequestHandler[],
  verifiedSeller: [authenticate, requireVerifiedSeller, requirePinIfDormant] as RequestHandler[],
  moderator: [authenticate, requireStaff('MODERATOR')] as RequestHandler[],
  compliance: [authenticate, requireStaff('COMPLIANCE_OFFICER')] as RequestHandler[],
  adminLead: [authenticate, requireStaff('ADMIN_LEAD')] as RequestHandler[]
};
