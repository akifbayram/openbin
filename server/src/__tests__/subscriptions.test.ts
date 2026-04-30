import crypto from 'node:crypto';
import type { Express } from 'express';
import * as jose from 'jose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----
// Use vi.mock before other imports so it's hoisted correctly.
// We set subscriptionJwtSecret to a known value so the route can verify tokens.
vi.mock('../ee/lifecycleEmails.js', () => ({
  fireSubscriptionConfirmedEmail: vi.fn(),
  fireSubscriptionExpiredEmail: vi.fn(),
  fireDowngradeImpactEmail: vi.fn(),
}));

vi.mock('../lib/config.js', () => ({
  config: {
    port: 1453,
    databasePath: ':memory:',
    photoStoragePath: '/tmp/openbin-test-photos',
    corsOrigin: 'http://localhost:5173',
    jwtSecret: 'test-secret',
    accessTokenExpiresIn: '15m',
    refreshTokenMaxDays: 7,
    cookieSecure: false,
    bcryptRounds: 10,
    registrationMode: 'open',
    trustProxy: false,
    selfHosted: false,
    managerUrl: null,
    subscriptionJwtSecret: 'test-subscription-secret',
    subscriptionWebhookSecret: 'test-webhook-secret',
    demoMode: false,
    aiMock: false,
    demoUsernames: new Set<string>(),
    maxPhotoSizeMb: 5,
    maxAvatarSizeMb: 2,
    maxPhotosPerBin: 1,
    uploadQuotaDemoMb: 5,
    uploadQuotaGlobalDemoMb: 50,
    aiProvider: null,
    aiApiKey: null,
    aiModel: null,
    aiEndpointUrl: null,
    backupEnabled: false,
    backupInterval: 'daily',
    backupRetention: 7,
    backupPath: './data/backups',
    backupWebhookUrl: '',
    qrPayloadMode: 'app',
    baseUrl: null,
    disableRateLimit: true,
    demoAiRateLimit: 10,
    demoAiMaxPhotosPerRequest: 3,
    demoAiDailyBudget: 100,
    trialPeriodDays: 7,
  },
  hasEnvAiConfig: () => false,
  getEnvAiConfig: () => null,
  isDemoUser: () => false,
}));

// ---- Imports (after mocks) ----

import { query } from '../db.js';
import { subscriptionsRoutes } from '../ee/routes/subscriptions.js';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

const SUB_SECRET = 'test-webhook-secret';

let app: Express;

beforeEach(() => {
  app = createApp({
    mountEeRoutes: (a) => a.use('/api/subscriptions', subscriptionsRoutes),
  });
});

interface SignOpts {
  expiresIn?: number | string;
  issuer?: string | null;
  audience?: string | null;
  jti?: string | null;
  omitIat?: boolean;
}

async function makeSubToken(
  payload: Record<string, unknown>,
  secret = SUB_SECRET,
  opts: SignOpts = {},
) {
  const signer = new jose.SignJWT(payload as jose.JWTPayload).setProtectedHeader({ alg: 'HS256' });
  if (!opts.omitIat) signer.setIssuedAt();
  if (opts.issuer !== null) signer.setIssuer(opts.issuer ?? 'openbin-manager');
  if (opts.audience !== null) signer.setAudience(opts.audience ?? 'openbin-backend');
  if (opts.jti !== null) signer.setJti(opts.jti ?? crypto.randomUUID());
  if (opts.expiresIn === undefined) {
    signer.setExpirationTime('5m');
  } else if (typeof opts.expiresIn === 'number' && opts.expiresIn < 0) {
    signer.setExpirationTime(Math.floor(Date.now() / 1000) - 60);
  } else {
    signer.setExpirationTime(opts.expiresIn);
  }
  return signer.sign(new TextEncoder().encode(secret));
}

describe('POST /api/subscriptions/callback', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/subscriptions/callback').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', 'Basic sometoken')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when JWT is signed with wrong secret', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({ userId: user.id, plan: 1, status: 1, activeUntil: null }, 'wrong-secret');

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(res.body.message).toBe('Invalid subscription token');
  });

  it('returns 401 when JWT is expired', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken(
      { userId: user.id, plan: 1, status: 1, activeUntil: null },
      SUB_SECRET,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 404 in self-hosted mode', async () => {
    const { config: mockConfig } = await import('../lib/config.js');
    const original = mockConfig.selfHosted;
    Object.defineProperty(mockConfig, 'selfHosted', { value: true, writable: true, configurable: true });
    try {
      const token = await makeSubToken({ userId: 'u1', plan: 1, status: 1, activeUntil: null });
      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(404);
    } finally {
      Object.defineProperty(mockConfig, 'selfHosted', { value: original, writable: true, configurable: true });
    }
  });

  it('returns 503 when subscriptionWebhookSecret is not configured', async () => {
    const { config: mockConfig } = await import('../lib/config.js');
    const original = mockConfig.subscriptionWebhookSecret;
    Object.defineProperty(mockConfig, 'subscriptionWebhookSecret', { value: null, writable: true, configurable: true });
    try {
      const token = await makeSubToken({ userId: 'u1', plan: 1, status: 1, activeUntil: null });
      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('SERVICE_NOT_CONFIGURED');
    } finally {
      Object.defineProperty(mockConfig, 'subscriptionWebhookSecret', { value: original, writable: true, configurable: true });
    }
  });

  it('returns 422 when plan value is invalid', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({ userId: user.id, plan: 99, status: 1, activeUntil: null });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Invalid plan value');
  });

  it('returns 422 when status value is invalid', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({ userId: user.id, plan: 1, status: 99, activeUntil: null });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Invalid status value');
  });

  it('returns 422 when userId is missing from payload', async () => {
    const token = await makeSubToken({ plan: 1, status: 1, activeUntil: null });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Invalid callback payload');
  });

  it('logs orphan and returns 200 for unknown userId (hard-deleted)', async () => {
    // A deleted-then-recreated user (different userId, same email) is
    // covered by this same path: the new user has a different id, so any
    // pending webhook bound to the old id still lands here as orphaned.
    const token = await makeSubToken({ userId: 'nonexistent-user-id', plan: 1, status: 1, activeUntil: null });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.orphaned).toBe(true);

    const orphans = await query<{ user_id_attempted: string; reason: string; payload_json: string }>(
      'SELECT user_id_attempted, reason, payload_json FROM subscription_orphans WHERE user_id_attempted = $1',
      ['nonexistent-user-id'],
    );
    expect(orphans.rows.length).toBe(1);
    expect(orphans.rows[0].reason).toBe('user_not_found');
    const parsed = JSON.parse(orphans.rows[0].payload_json);
    expect(parsed.userId).toBe('nonexistent-user-id');
    expect(parsed.plan).toBe(1);
    expect(parsed.status).toBe(1);
  });

  it('updates user plan to PRO with active status', async () => {
    const { user } = await createTestUser(app);
    const activeUntil = '2027-06-01T00:00:00.000Z';
    const token = await makeSubToken({ userId: user.id, plan: 1, status: 1, activeUntil });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify DB was updated
    const dbResult = await query<{ plan: number; sub_status: number; active_until: string | null }>(
      'SELECT plan, sub_status, active_until FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].plan).toBe(1);
    expect(dbResult.rows[0].sub_status).toBe(1);
    expect(dbResult.rows[0].active_until).toBe(activeUntil);
  });

  it('updates user plan to LITE with inactive status', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({ userId: user.id, plan: 0, status: 0, activeUntil: null });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const dbResult = await query<{ plan: number; sub_status: number; active_until: string | null }>(
      'SELECT plan, sub_status, active_until FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].plan).toBe(0);
    expect(dbResult.rows[0].sub_status).toBe(0);
    expect(dbResult.rows[0].active_until).toBeNull();
  });

  it('updates user to trial status (status=2)', async () => {
    const { user } = await createTestUser(app);
    const activeUntil = '2026-12-31T00:00:00.000Z';
    const token = await makeSubToken({ userId: user.id, plan: 0, status: 2, activeUntil });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const dbResult = await query<{ plan: number; sub_status: number; active_until: string | null }>(
      'SELECT plan, sub_status, active_until FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].plan).toBe(0);
    expect(dbResult.rows[0].sub_status).toBe(2);
    expect(dbResult.rows[0].active_until).toBe(activeUntil);
  });

  it('sets active_until to null when not provided in payload', async () => {
    const { user } = await createTestUser(app);
    // activeUntil omitted from payload
    const token = await makeSubToken({ userId: user.id, plan: 1, status: 1 });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);

    const dbResult = await query<{ active_until: string | null }>(
      'SELECT active_until FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].active_until).toBeNull();
  });

  it('persists cancelAtPeriodEnd and billingPeriod on users row', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({
      userId: user.id,
      plan: 0,    // Plan.PLUS
      status: 1,  // SubStatus.ACTIVE
      activeUntil: '2026-05-27T00:00:00Z',
      cancelAtPeriodEnd: '2026-05-27T00:00:00Z',
      billingPeriod: 'monthly',
    });

    const res = await request(app)
      .post('/api/subscriptions/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);

    const row = await query<{ cancel_at_period_end: string | null; billing_period: string | null }>(
      'SELECT cancel_at_period_end, billing_period FROM users WHERE id = $1',
      [user.id],
    );
    expect(row.rows[0].cancel_at_period_end).toBe('2026-05-27T00:00:00Z');
    expect(row.rows[0].billing_period).toBe('monthly');
  });

  it('clears cancelAtPeriodEnd when payload omits it (subscription resumed)', async () => {
    const { user } = await createTestUser(app);
    // First, set cancel_at_period_end to a non-null value
    const token1 = await makeSubToken({
      userId: user.id, plan: 0, status: 1,
      activeUntil: '2026-05-27T00:00:00Z',
      cancelAtPeriodEnd: '2026-05-27T00:00:00Z',
      billingPeriod: 'monthly',
    });
    await request(app).post('/api/subscriptions/callback').set('Authorization', `Bearer ${token1}`).send({});

    // Now send a webhook that omits cancelAtPeriodEnd (subscription resumed)
    const token2 = await makeSubToken({
      userId: user.id, plan: 0, status: 1,
      activeUntil: '2026-06-27T00:00:00Z',
      billingPeriod: 'monthly',
      // no cancelAtPeriodEnd
    });
    const res = await request(app).post('/api/subscriptions/callback').set('Authorization', `Bearer ${token2}`).send({});
    expect(res.status).toBe(200);

    const row = await query<{ cancel_at_period_end: string | null }>(
      'SELECT cancel_at_period_end FROM users WHERE id = $1',
      [user.id],
    );
    expect(row.rows[0].cancel_at_period_end).toBeNull();
  });

  it('rejects invalid billingPeriod values', async () => {
    const { user } = await createTestUser(app);
    const token = await makeSubToken({
      userId: user.id, plan: 0, status: 1, activeUntil: '2026-05-27T00:00:00Z',
      billingPeriod: 'quarterly',
    });
    const res = await request(app).post('/api/subscriptions/callback').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(422);  // ValidationError
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  describe('lifecycle email gating', () => {
    it('skips lifecycle emails for soft-deleted users', async () => {
      const { user } = await createTestUser(app);
      // Mark the user as soft-deleted (in recovery grace window).
      await query(
        `UPDATE users SET deletion_requested_at = ${"'2026-04-01T00:00:00Z'"} WHERE id = $1`,
        [user.id],
      );

      const lifecycleEmails = await import('../ee/lifecycleEmails.js');
      const confirmedSpy = vi.mocked(lifecycleEmails.fireSubscriptionConfirmedEmail);
      const expiredSpy = vi.mocked(lifecycleEmails.fireSubscriptionExpiredEmail);
      confirmedSpy.mockClear();
      expiredSpy.mockClear();

      const token = await makeSubToken({ userId: user.id, plan: 1, status: 1, activeUntil: '2027-01-01T00:00:00Z' });
      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);

      // UPDATE still succeeded
      const dbResult = await query<{ plan: number; sub_status: number }>(
        'SELECT plan, sub_status FROM users WHERE id = $1',
        [user.id],
      );
      expect(dbResult.rows[0].plan).toBe(1);
      expect(dbResult.rows[0].sub_status).toBe(1);

      // No emails fired
      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(expiredSpy).not.toHaveBeenCalled();
    });

    it('fires lifecycle emails for normal users (sanity check)', async () => {
      const { user } = await createTestUser(app);

      const lifecycleEmails = await import('../ee/lifecycleEmails.js');
      const confirmedSpy = vi.mocked(lifecycleEmails.fireSubscriptionConfirmedEmail);
      confirmedSpy.mockClear();

      const token = await makeSubToken({ userId: user.id, plan: 1, status: 1, activeUntil: '2027-01-01T00:00:00Z' });
      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);

      expect(confirmedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('replay & claim validation', () => {
    it('rejects reused token (jti replay)', async () => {
      const { user } = await createTestUser(app);
      const token = await makeSubToken({ userId: user.id, plan: 1, status: 1, activeUntil: null });

      const first = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(first.status).toBe(200);

      const replay = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(replay.status).toBe(401);
      expect(replay.body.error).toBe('UNAUTHORIZED');
      expect(replay.body.message).toBe('Token already used');
    });

    it('rejects token missing jti claim', async () => {
      const { user } = await createTestUser(app);
      const token = await makeSubToken(
        { userId: user.id, plan: 1, status: 1, activeUntil: null },
        SUB_SECRET,
        { jti: null },
      );

      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('rejects token missing issuer', async () => {
      const { user } = await createTestUser(app);
      const token = await makeSubToken(
        { userId: user.id, plan: 1, status: 1, activeUntil: null },
        SUB_SECRET,
        { issuer: null },
      );

      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('rejects token with wrong audience', async () => {
      const { user } = await createTestUser(app);
      const token = await makeSubToken(
        { userId: user.id, plan: 1, status: 1, activeUntil: null },
        SUB_SECRET,
        { audience: 'some-other-service' },
      );

      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('rejects token missing iat claim', async () => {
      const { user } = await createTestUser(app);
      const token = await makeSubToken(
        { userId: user.id, plan: 1, status: 1, activeUntil: null },
        SUB_SECRET,
        { omitIat: true },
      );

      const res = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('does not consume jti when payload validation fails', async () => {
      const { user } = await createTestUser(app);
      const jti = crypto.randomUUID();
      const badToken = await makeSubToken(
        { userId: user.id, plan: 99, status: 1, activeUntil: null },
        SUB_SECRET,
        { jti },
      );
      const bad = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${badToken}`)
        .send({});
      expect(bad.status).toBe(422);

      // Reusing the same jti in a well-formed payload must still be accepted.
      const goodToken = await makeSubToken(
        { userId: user.id, plan: 1, status: 1, activeUntil: null },
        SUB_SECRET,
        { jti },
      );
      const good = await request(app)
        .post('/api/subscriptions/callback')
        .set('Authorization', `Bearer ${goodToken}`)
        .send({});
      expect(good.status).toBe(200);
    });
  });
});
