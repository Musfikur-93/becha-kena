import crypto from 'node:crypto';

import { ERROR_CODES, type UserRole } from '@becha-kena/shared';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import { getRedis } from '../config/redis.js';
import { userRepository } from '../repositories/index.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/crypto.js';

export const ACCESS_COOKIE_NAME = 'bk_access_token';
export const REFRESH_COOKIE_NAME = 'bk_refresh_token';

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  isSellerVerified: boolean;
  deviceId?: string;
  jti: string;
}

interface StoredRefreshSession {
  userId: string;
  deviceId?: string;
  familyId: string;
  createdAt: number;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'jti'> & { jti?: string }): string {
  const jti = payload.jti ?? crypto.randomUUID();
  return jwt.sign(
    {
      userId: payload.userId,
      role: payload.role,
      isSellerVerified: payload.isSellerVerified,
      deviceId: payload.deviceId,
      jti
    },
    config.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: config.JWT_ACCESS_TTL
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ['HS256']
    }) as AccessTokenPayload;
    if (!decoded || typeof decoded.userId !== 'string' || typeof decoded.role !== 'string') {
      throw AppError.unauthorized('Invalid access token payload.');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Access token is invalid or expired.');
  }
}

export async function issueSession(params: {
  userId: string;
  role: UserRole;
  isSellerVerified: boolean;
  deviceId?: string;
  familyId?: string;
}): Promise<{ accessToken: string; refreshToken: string; familyId: string }> {
  const redis = getRedis();
  const familyId = params.familyId ?? crypto.randomUUID();
  const refreshToken = randomToken(32);
  const hash = sha256(refreshToken);

  const sessionData: StoredRefreshSession = {
    userId: params.userId,
    deviceId: params.deviceId,
    familyId,
    createdAt: Date.now()
  };

  await redis.set(
    `refresh:${hash}`,
    JSON.stringify(sessionData),
    'EX',
    config.REFRESH_TTL_SECONDS
  );
  await redis.sadd(`user_sessions:${params.userId}`, hash);
  await redis.expire(`user_sessions:${params.userId}`, config.REFRESH_TTL_SECONDS);
  await redis.sadd(`family_sessions:${familyId}`, hash);
  await redis.expire(`family_sessions:${familyId}`, config.REFRESH_TTL_SECONDS);

  const accessToken = signAccessToken({
    userId: params.userId,
    role: params.role,
    isSellerVerified: params.isSellerVerified,
    deviceId: params.deviceId
  });

  return { accessToken, refreshToken, familyId };
}

export async function revokeTokenFamily(familyId: string, userId?: string): Promise<void> {
  const redis = getRedis();
  const hashes = await redis.smembers(`family_sessions:${familyId}`);
  if (hashes.length > 0) {
    const keys = hashes.flatMap((h) => [`refresh:${h}`, `used_refresh:${h}`]);
    await redis.del(...keys);
    if (userId) {
      await redis.srem(`user_sessions:${userId}`, ...hashes);
    }
  }
  await redis.del(`family_sessions:${familyId}`);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const redis = getRedis();
  const hashes = await redis.smembers(`user_sessions:${userId}`);
  if (hashes.length > 0) {
    const keys = hashes.flatMap((h) => [`refresh:${h}`, `used_refresh:${h}`]);
    await redis.del(...keys);
  }
  await redis.del(`user_sessions:${userId}`);
}

export async function revokeSingleRefreshToken(rawToken: string): Promise<void> {
  const redis = getRedis();
  const hash = sha256(rawToken);
  const raw = await redis.get(`refresh:${hash}`);
  if (raw) {
    const parsed = JSON.parse(raw) as StoredRefreshSession;
    await redis.del(`refresh:${hash}`);
    await redis.srem(`user_sessions:${parsed.userId}`, hash);
    await redis.srem(`family_sessions:${parsed.familyId}`, hash);
  }
}

export async function rotateRefreshToken(rawToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const redis = getRedis();
  const hash = sha256(rawToken);

  // Reuse / theft detection: if this token was already rotated earlier, nuke the entire family!
  const reusedFamilyRaw = await redis.get(`used_refresh:${hash}`);
  if (reusedFamilyRaw) {
    const reused = JSON.parse(reusedFamilyRaw) as { familyId: string; userId: string };
    await revokeTokenFamily(reused.familyId, reused.userId);
    throw AppError.unauthorized(
      'Refresh token reuse detected. Session revoked for your security.',
      ERROR_CODES.REFRESH_TOKEN_EXPIRED
    );
  }

  const storedRaw = await redis.get(`refresh:${hash}`);
  if (!storedRaw) {
    throw AppError.unauthorized(
      'Refresh token is invalid or expired.',
      ERROR_CODES.REFRESH_TOKEN_EXPIRED
    );
  }

  const session = JSON.parse(storedRaw) as StoredRefreshSession;

  const isBanned = await redis.sismember('banned_users', session.userId);
  if (isBanned) {
    await revokeAllUserSessions(session.userId);
    throw AppError.forbidden(
      'This account has been suspended or banned.',
      ERROR_CODES.ACCOUNT_SUSPENDED_OR_BANNED
    );
  }

  const user = await userRepository.findById(session.userId);
  if (!user || user.status !== 'active') {
    await revokeAllUserSessions(session.userId);
    throw AppError.forbidden(
      'This account is no longer active.',
      ERROR_CODES.ACCOUNT_SUSPENDED_OR_BANNED
    );
  }

  // Delete active refresh key and record it as used for reuse/theft detection
  await redis.del(`refresh:${hash}`);
  await redis.srem(`user_sessions:${session.userId}`, hash);
  await redis.set(
    `used_refresh:${hash}`,
    JSON.stringify({ familyId: session.familyId, userId: session.userId }),
    'EX',
    config.REFRESH_TTL_SECONDS
  );

  const issued = await issueSession({
    userId: user._id.toString(),
    role: user.role,
    isSellerVerified: user.sellerProfile.isSellerVerified,
    deviceId: session.deviceId,
    familyId: session.familyId
  });

  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    userId: user._id.toString()
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void {
  const isProd = config.NODE_ENV === 'production';

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: config.JWT_ACCESS_TTL * 1000
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: config.REFRESH_TTL_SECONDS * 1000
  });
}

export function clearAuthCookies(res: Response): void {
  const isProd = config.NODE_ENV === 'production';
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth'
  });
}
