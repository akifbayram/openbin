import express, { type Express } from 'express';
import * as jose from 'jose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----
// Mirrors subscriptions.test.ts so we can mutate config (real config is frozen).

vi.mock('../lib/config.js', () => ({
  config: {
    selfHosted: false,
    subscriptionJwtSecret: 'test-subscription-secret',
    subscriptionWebhookSecret: 'test-webhook-secret',
    managerUrl: null,
  },
  hasEnvAiConfig: () => false,
  getEnvAiConfig: () => null,
  isDemoUser: () => false,
}));

// ---- Imports (after mocks) ----

import { generateUuid, query } from '../db.js';
import { HttpError } from '../lib/httpErrors.js';
import { getSubscriptionSecretKey } from '../lib/planGate.js';
import { internalRoutes } from '../routes/internal.js';

let app: Express;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1', internalRoutes);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});

async function signManagerJwt(secret: Uint8Array = getSubscriptionSecretKey()): Promise<string> {
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('openbin-manager')
    .setAudience('openbin-backend')
    .setJti(generateUuid())
    .setExpirationTime('5m')
    .sign(secret);
}

describe('GET /api/v1/users/:userId/exists', () => {
  it('returns 401 without bearer token', async () => {
    const res = await request(app).get('/api/v1/users/abc/exists');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 with wrong secret', async () => {
    const token = await signManagerJwt(new TextEncoder().encode('wrong-secret'));
    const res = await request(app)
      .get('/api/v1/users/abc/exists')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 with wrong issuer', async () => {
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('not-openbin-manager')
      .setAudience('openbin-backend')
      .setJti(generateUuid())
      .setExpirationTime('5m')
      .sign(getSubscriptionSecretKey());
    const res = await request(app)
      .get('/api/v1/users/abc/exists')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns { exists: true } for a real user', async () => {
    const userId = generateUuid();
    await query(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, 'h', 'U')`,
      [userId, `u_${userId}@test.local`],
    );
    const token = await signManagerJwt();
    const res = await request(app)
      .get(`/api/v1/users/${userId}/exists`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true });
  });

  it('returns { exists: false } for a missing user', async () => {
    const token = await signManagerJwt();
    const res = await request(app)
      .get(`/api/v1/users/${generateUuid()}/exists`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it('returns 404 in self-host mode', async () => {
    const { config: mockConfig } = await import('../lib/config.js');
    const original = mockConfig.selfHosted;
    Object.defineProperty(mockConfig, 'selfHosted', { value: true, writable: true, configurable: true });
    try {
      const token = await signManagerJwt();
      const res = await request(app)
        .get(`/api/v1/users/abc/exists`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    } finally {
      Object.defineProperty(mockConfig, 'selfHosted', { value: original, writable: true, configurable: true });
    }
  });
});
