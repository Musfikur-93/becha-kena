import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guards } from '../../src/api/middlewares/auth.js';
import { requireDeviceId } from '../../src/api/middlewares/deviceId.js';
import { requireIdempotency } from '../../src/api/middlewares/idempotency.js';
import { ipSubnet24, rateLimit } from '../../src/api/middlewares/rateLimit.js';
import { requireTurnstile } from '../../src/api/middlewares/turnstile.js';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/env.js';
import { User } from '../../src/models/index.js';
import {
  ACCESS_COOKIE_NAME,
  issueSession,
  rotateRefreshToken,
  signAccessToken
} from '../../src/services/token.service.js';
import { decryptAesGcm, encryptAesGcm } from '../../src/utils/crypto.js';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db.js';
import { clearTestRedis, setupTestRedis, teardownTestRedis } from '../helpers/redis.js';

describe('Phase B04: Security & Cross-Cutting Middleware', () => {
  let idempotencyCounter = 0;

  const app = createApp({
    registerExtraRoutes(router) {
      router.get('/__sec/user', ...guards.user, (req, res) => {
        res.json({ success: true, data: { user: req.user } });
      });

      router.get('/__sec/seller', ...guards.verifiedSeller, (req, res) => {
        res.json({ success: true, data: { sellerId: req.user?.id } });
      });

      router.get('/__sec/moderator', ...guards.moderator, (_req, res) => {
        res.json({ success: true, data: { ok: true } });
      });

      router.post(
        '/__sec/rate-limited',
        rateLimit({
          dimensions: (req) => [
            { key: `rl:test:${req.headers['x-test-actor'] ?? 'a'}`, limit: 5, windowSec: 3600 }
          ]
        }),
        (_req, res) => {
          res.json({ success: true, data: { ok: true } });
        }
      );

      router.post('/__sec/idempotent', requireIdempotency(), (req, res) => {
        idempotencyCounter += 1;
        res.status(201).json({
          success: true,
          data: { executionCount: idempotencyCounter, title: req.body.title }
        });
      });

      router.post('/__sec/turnstile-device', requireTurnstile, requireDeviceId, (req, res) => {
        res.json({ success: true, data: { deviceId: req.deviceId } });
      });
    }
  });

  beforeAll(async () => {
    await connectTestDb();
    setupTestRedis();
  });

  beforeEach(async () => {
    idempotencyCounter = 0;
    await clearTestDb();
    await clearTestRedis();
  });

  afterAll(async () => {
    teardownTestRedis();
    await disconnectTestDb();
  });

  describe('JWT authenticate, ban revocation & RBAC hierarchy', () => {
    it('rejects missing, tampered, and expired JWT cookies with 401 UNAUTHORIZED', async () => {
      const noCookie = await request(app).get('/api/v1/__sec/user');
      expect(noCookie.status).toBe(401);
      expect(noCookie.body.error.code).toBe('UNAUTHORIZED');

      const tampered = await request(app)
        .get('/api/v1/__sec/user')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=invalid.token.here`);
      expect(tampered.status).toBe(401);

      const expired = jwt.sign(
        { userId: 'u1', role: 'USER', isSellerVerified: false, jti: 'j1' },
        config.JWT_ACCESS_SECRET,
        { expiresIn: -10 }
      );
      const expiredRes = await request(app)
        .get('/api/v1/__sec/user')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${expired}`);
      expect(expiredRes.status).toBe(401);
    });

    it('immediately blocks banned users via Redis banned_users set (<1ms check)', async () => {
      const redis = setupTestRedis();
      const userId = '6735e0a01234567890abcde1';
      await redis.sadd('banned_users', userId);

      const token = signAccessToken({ userId, role: 'USER', isSellerVerified: false });
      const res = await request(app)
        .get('/api/v1/__sec/user')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED_OR_BANNED');
    });

    it('enforces staff role hierarchy (ADMIN_LEAD passes MODERATOR+; USER fails)', async () => {
      const adminToken = signAccessToken({
        userId: 'admin-1',
        role: 'ADMIN_LEAD',
        isSellerVerified: false
      });
      const userToken = signAccessToken({
        userId: 'user-1',
        role: 'USER',
        isSellerVerified: true
      });

      const adminRes = await request(app)
        .get('/api/v1/__sec/moderator')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${adminToken}`);
      expect(adminRes.status).toBe(200);

      const userRes = await request(app)
        .get('/api/v1/__sec/moderator')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${userToken}`);
      expect(userRes.status).toBe(403);
      expect(userRes.body.error.code).toBe('FORBIDDEN');
    });

    it('enforces requireVerifiedSeller against DB/Redis cache', async () => {
      const buyer = await User.create({ phoneNumber: '+8801711111111' });
      const seller = await User.create({
        phoneNumber: '+8801711111112',
        sellerProfile: { displayName: 'Verified', kycStatus: 'verified', isSellerVerified: true }
      });

      const buyerToken = signAccessToken({
        userId: buyer._id.toString(),
        role: 'USER',
        isSellerVerified: false
      });
      const sellerToken = signAccessToken({
        userId: seller._id.toString(),
        role: 'USER',
        isSellerVerified: true
      });

      const buyerRes = await request(app)
        .get('/api/v1/__sec/seller')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${buyerToken}`);
      expect(buyerRes.status).toBe(403);
      expect(buyerRes.body.error.code).toBe('FORBIDDEN_KYC_REQUIRED');

      const sellerRes = await request(app)
        .get('/api/v1/__sec/seller')
        .set('Cookie', `${ACCESS_COOKIE_NAME}=${sellerToken}`);
      expect(sellerRes.status).toBe(200);
    });
  });

  describe('Sliding-window rate limiter & IP subnet helper', () => {
    it('allows 5 requests and blocks the 6th with 429 + Retry-After headers', async () => {
      for (let i = 1; i <= 5; i += 1) {
        const res = await request(app)
          .post('/api/v1/__sec/rate-limited')
          .set('X-Test-Actor', 'actor-1');
        expect(res.status).toBe(200);
        expect(res.headers['x-ratelimit-remaining']).toBe(String(5 - i));
      }

      const blocked = await request(app)
        .post('/api/v1/__sec/rate-limited')
        .set('X-Test-Actor', 'actor-1');
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blocked.body.error.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('computes /24 for IPv4 and /64 for IPv6', () => {
      expect(ipSubnet24('::ffff:103.205.71.18')).toBe('103.205.71.0/24');
      expect(ipSubnet24('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:0::/64');
    });
  });

  describe('Idempotency-Key middleware', () => {
    it('replays identical response for repeated key and rejects mismatched payload with 422', async () => {
      const key = crypto.randomUUID();

      const first = await request(app)
        .post('/api/v1/__sec/idempotent')
        .set('Idempotency-Key', key)
        .send({ title: 'Phone A' });
      expect(first.status).toBe(201);
      expect(first.body.data.executionCount).toBe(1);

      const replay = await request(app)
        .post('/api/v1/__sec/idempotent')
        .set('Idempotency-Key', key)
        .send({ title: 'Phone A' });
      expect(replay.status).toBe(201);
      expect(replay.body.data.executionCount).toBe(1);

      const mismatch = await request(app)
        .post('/api/v1/__sec/idempotent')
        .set('Idempotency-Key', key)
        .send({ title: 'Different Payload' });
      expect(mismatch.status).toBe(422);
      expect(mismatch.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('Refresh token rotation & theft detection', () => {
    it('rotates tokens cleanly and revokes entire family if an old token is reused', async () => {
      const user = await User.create({ phoneNumber: '+8801744000001' });
      const initial = await issueSession({
        userId: user._id.toString(),
        role: 'USER',
        isSellerVerified: false,
        deviceId: 'dev-1'
      });

      const rotated = await rotateRefreshToken(initial.refreshToken);
      expect(rotated.refreshToken).not.toBe(initial.refreshToken);

      // Reusing initial token triggers family revocation!
      await expect(rotateRefreshToken(initial.refreshToken)).rejects.toThrow(/reuse/i);

      // Even the newer rotated token in the same family must now be revoked!
      await expect(rotateRefreshToken(rotated.refreshToken)).rejects.toThrow(/expired|invalid/i);
    });
  });

  describe('Turnstile, DeviceId & AES-256-GCM crypto', () => {
    it('validates X-Turnstile-Token and X-Device-Id headers', async () => {
      const bad = await request(app)
        .post('/api/v1/__sec/turnstile-device')
        .set('X-Turnstile-Token', 'bad-token')
        .set('X-Device-Id', 'device-1234');
      expect(bad.status).toBe(400);

      const good = await request(app)
        .post('/api/v1/__sec/turnstile-device')
        .set('X-Turnstile-Token', 'test-pass')
        .set('X-Device-Id', 'device-1234');
      expect(good.status).toBe(200);
      expect(good.body.data.deviceId).toBe('device-1234');
    });

    it('encrypts and decrypts payloads accurately using AES-256-GCM', () => {
      const secret = JSON.stringify({ nid: '1234567890', status: 'VERIFIED' });
      const enc = encryptAesGcm(secret, config.KYC_RESPONSE_ENC_KEY);
      expect(enc).not.toContain('1234567890');
      expect(decryptAesGcm(enc, config.KYC_RESPONSE_ENC_KEY)).toBe(secret);
    });
  });
});
