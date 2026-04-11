import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    emailEnabled: false,
    planLimits: {
      freeMaxBins: 10,
      freeMaxLocations: 1,
      freeMaxStorageMb: 0,
      freeMaxMembers: 1,
      freeAi: true,
      freeApiKeys: false,
      freeCustomFields: false,
      freeFullExport: false,
      freeReorganize: false,
      freeBinSharing: false,
      freeActivityRetentionDays: 7,
      freeAiCreditsPerMonth: 10,
    },
  },
  hasEnvAiConfig: () => false,
  getEnvAiConfig: () => null,
  isDemoUser: () => false,
}));

import { query } from '../db.js';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

async function setUserPlan(userId: string, plan: number, subStatus: number, activeUntil: string | null = null, previousSubStatus: number | null = null) {
  await query(
    'UPDATE users SET plan = $1, sub_status = $2, active_until = $3, previous_sub_status = $4 WHERE id = $5',
    [plan, subStatus, activeUntil, previousSubStatus, userId],
  );
}

describe('POST /api/plan/downgrade-to-free', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/plan/downgrade-to-free');
    expect(res.status).toBe(401);
  });

  it('downgrades a Plus trial user to Free/Active', async () => {
    const { token, user } = await createTestUser(app);
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await setUserPlan(user.id, 0, 2, trialEnd); // Plus=0, Trial=2

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify DB state
    const dbResult = await query<{ plan: number; sub_status: number; active_until: string | null; previous_sub_status: number | null }>(
      'SELECT plan, sub_status, active_until, previous_sub_status FROM users WHERE id = $1',
      [user.id],
    );
    const row = dbResult.rows[0];
    expect(row.plan).toBe(2);           // FREE = 2
    expect(row.sub_status).toBe(1);     // ACTIVE = 1
    expect(row.active_until).toBeNull();
    expect(row.previous_sub_status).toBeNull();
  });

  it('downgrades a locked post-trial user to Free/Active', async () => {
    const { token, user } = await createTestUser(app);
    // Plus=0, Inactive=0, previousSubStatus=Trial(2)
    await setUserPlan(user.id, 0, 0, null, 2);

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const dbResult = await query<{ plan: number; sub_status: number; active_until: string | null; previous_sub_status: number | null }>(
      'SELECT plan, sub_status, active_until, previous_sub_status FROM users WHERE id = $1',
      [user.id],
    );
    const row = dbResult.rows[0];
    expect(row.plan).toBe(2);           // FREE
    expect(row.sub_status).toBe(1);     // ACTIVE
    expect(row.active_until).toBeNull();
    expect(row.previous_sub_status).toBeNull();
  });

  it('downgrades a locked post-cancel user to Free/Active', async () => {
    const { token, user } = await createTestUser(app);
    // Pro=1, Inactive=0, previousSubStatus=Active(1)
    await setUserPlan(user.id, 1, 0, null, 1);

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const dbResult = await query<{ plan: number; sub_status: number }>(
      'SELECT plan, sub_status FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].plan).toBe(2);       // FREE
    expect(dbResult.rows[0].sub_status).toBe(1);  // ACTIVE
  });

  it('rejects if user is already on Free plan', async () => {
    const { token, user } = await createTestUser(app);
    await setUserPlan(user.id, 2, 1); // Free=2, Active=1

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Already on the Free plan');
  });

  it('rejects if user has an active paid subscription', async () => {
    const { token, user } = await createTestUser(app);
    await setUserPlan(user.id, 0, 1); // Plus=0, Active=1

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Cancel your paid subscription before downgrading to Free');
  });

  it('allows downgrade when subStatus is ACTIVE but activeUntil is expired (passively locked)', async () => {
    const { token, user } = await createTestUser(app);
    // Plus=0, Active=1, but activeUntil in the past → effectively locked
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await setUserPlan(user.id, 0, 1, pastDate);

    const res = await request(app)
      .post('/api/plan/downgrade-to-free')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const dbResult = await query<{ plan: number; sub_status: number }>(
      'SELECT plan, sub_status FROM users WHERE id = $1',
      [user.id],
    );
    expect(dbResult.rows[0].plan).toBe(2);       // FREE
    expect(dbResult.rows[0].sub_status).toBe(1);  // ACTIVE
  });

  it('rejects in self-hosted mode', async () => {
    const { config: mockConfig } = await import('../lib/config.js');
    const original = mockConfig.selfHosted;
    Object.defineProperty(mockConfig, 'selfHosted', { value: true, writable: true, configurable: true });
    try {
      const { token } = await createTestUser(app);
      const res = await request(app)
        .post('/api/plan/downgrade-to-free')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    } finally {
      Object.defineProperty(mockConfig, 'selfHosted', { value: original, writable: true, configurable: true });
    }
  });
});
