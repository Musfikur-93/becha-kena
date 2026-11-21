import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { deprecated } from '../../src/api/middlewares/deprecation.js';
import { validate } from '../../src/api/middlewares/validate.js';
import { createApp } from '../../src/app.js';

describe('Phase B02: API Core Infrastructure', () => {
  const app = createApp({
    registerExtraRoutes(router) {
      router.post(
        '/__test/validate',
        validate({
          body: z.object({
            address: z.object({ thana: z.string().min(2) }),
            price: z.number().min(10)
          })
        }),
        (_req, res) => {
          res.json({ success: true, data: { ok: true } });
        }
      );

      router.get('/__test/duplicate', (_req, _res, next) => {
        next({ code: 11000, message: 'E11000 duplicate key error' });
      });

      router.get('/__test/crash', () => {
        throw new Error('Super secret internal database stack detail');
      });

      router.get(
        '/__test/deprecated',
        deprecated({
          sunset: 'Wed, 17 Feb 2027 23:59:59 GMT',
          successor: 'https://api.bechakena.com/api/v2/listings'
        }),
        (_req, res) => {
          res.json({ success: true, data: { ok: true } });
        }
      );
    }
  });

  it('GET /api/v1/health returns 200 envelope with version headers', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-api-version']).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('1.0.0');
  });

  it('returns 404 RESOURCE_NOT_FOUND envelope with requestId for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
    expect(res.body.error.timestamp).toBeDefined();
  });

  it('formats Zod validation failures into 400 VALIDATION_ERROR with dot-path details', async () => {
    const res = await request(app)
      .post('/api/v1/__test/validate')
      .send({ address: { thana: 'a' }, price: 5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'address.thana' }),
        expect.objectContaining({ field: 'price' })
      ])
    );
  });

  it('maps Mongo E11000 duplicate key errors to 409 DUPLICATE_SUBMISSION', async () => {
    const res = await request(app).get('/api/v1/__test/duplicate');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SUBMISSION');
  });

  it('masks unhandled exceptions as 500 INTERNAL_SERVER_ERROR without leaking stack details', async () => {
    const res = await request(app).get('/api/v1/__test/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('Super secret internal');
  });

  it('returns 426 UPGRADE_REQUIRED when mobile build is below minimum threshold', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Client-Platform', 'android')
      .set('X-App-Build', '50');

    expect(res.status).toBe(426);
    expect(res.body.error.code).toBe('UPGRADE_REQUIRED');
  });

  it('emits RFC 8594 Deprecation, Sunset, and Link headers when deprecated() middleware is applied', async () => {
    const res = await request(app).get('/api/v1/__test/deprecated');
    expect(res.status).toBe(200);
    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['sunset']).toBe('Wed, 17 Feb 2027 23:59:59 GMT');
    expect(res.headers['link']).toBe(
      '<https://api.bechakena.com/api/v2/listings>; rel="successor-version"'
    );
  });
});
