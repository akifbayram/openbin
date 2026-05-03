import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----

vi.mock('../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    getUserFeatures: vi.fn(),
    isProUser: vi.fn(),
    isPlusOrAbove: vi.fn(),
    isSubscriptionActive: vi.fn(),
    hasAiAccess: vi.fn(),
    generateUpgradeUrl: vi.fn(),
    generateUpgradePlanUrl: vi.fn(),
  };
});

// ---- Imports (after mocks) ----

import { createApp } from '../index.js';
import {
  generateUpgradePlanUrl,
  generateUpgradeUrl,
  getUserFeatures,
  getUserPlanInfo,
  hasAiAccess,
  isPlusOrAbove,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
  Plan,
  SubStatus,
} from '../lib/planGate.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

/** Configure mocks so all plan checks pass for a Pro cloud user. */
function mockProUser() {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PRO,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'pro@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
  vi.mocked(isProUser).mockReturnValue(true);
  vi.mocked(isPlusOrAbove).mockReturnValue(true);
  vi.mocked(hasAiAccess).mockReturnValue(true);
  vi.mocked(getUserFeatures).mockResolvedValue({
    ai: true, apiKeys: true, customFields: true, fullExport: true,
    reorganize: true, binSharing: true, attachments: true, maxBins: null, maxLocations: null,
    maxPhotoStorageMb: null, maxMembersPerLocation: null, activityRetentionDays: null,
    aiCreditsPerMonth: null, reorganizeMaxBins: null,
  });
  vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
  vi.mocked(generateUpgradePlanUrl).mockResolvedValue(null);
}

/** Configure mocks so all plan checks fail for a Free cloud user. */
function mockFreeUser() {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.FREE,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'free@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
  vi.mocked(isProUser).mockReturnValue(false);
  vi.mocked(isPlusOrAbove).mockReturnValue(false);
  vi.mocked(hasAiAccess).mockReturnValue(true);
  vi.mocked(getUserFeatures).mockResolvedValue({
    ai: true, apiKeys: false, customFields: false, fullExport: false,
    reorganize: false, binSharing: false, attachments: false, maxBins: 10, maxLocations: 1,
    maxPhotoStorageMb: 0, maxMembersPerLocation: 1, activityRetentionDays: 7,
    aiCreditsPerMonth: 10, reorganizeMaxBins: null,
  });
  vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
  vi.mocked(generateUpgradePlanUrl).mockResolvedValue(null);
}

/** Configure mocks so the self-hosted fast-path is taken. */
function mockSelfHosted() {
  vi.mocked(isSelfHosted).mockReturnValue(true);
  vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
}

beforeEach(() => {
  app = createApp();
  vi.mocked(isSelfHosted).mockReset();
  vi.mocked(getUserPlanInfo).mockReset();
  vi.mocked(getUserFeatures).mockReset();
  vi.mocked(isProUser).mockReset();
  vi.mocked(isPlusOrAbove).mockReset();
  vi.mocked(isSubscriptionActive).mockReset();
  vi.mocked(hasAiAccess).mockReset();
  vi.mocked(generateUpgradeUrl).mockReset();
  vi.mocked(generateUpgradePlanUrl).mockReset();
});

// ---------------------------------------------------------------------------
// AI routes
// ---------------------------------------------------------------------------

describe('AI route plan gating', () => {
  it('GET /api/ai/settings returns 200 for cloud FREE user (AI assistant available to all)', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('GET /api/ai/settings works for self-hosted (no DB plan query)', async () => {
    mockSelfHosted();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);

    // Self-hosted bypasses plan gate — returns 200 (null AI config) not 403
    expect(res.status).toBe(200);
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });

  it('POST /api/ai/analyze/stream returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/ai/analyze/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ photoId: 'some-photo-id' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('POST /api/ai/structure-text passes plan gate for cloud FREE user (AI assistant available to all)', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/ai/structure-text')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello world' });

    // Free users pass the plan gate; non-403 means the gate didn't block
    expect(res.body.error).not.toBe('PLAN_RESTRICTED');
  });

});

// ---------------------------------------------------------------------------
// Export routes
// ---------------------------------------------------------------------------

describe('Export route plan gating', () => {
  it('GET /api/locations/:id/export returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('GET /api/locations/:id/export works for cloud PRO user', async () => {
    mockProUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });

  it('GET /api/locations/:id/export/zip returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export/zip`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('GET /api/locations/:id/export/csv is available for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export/csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('GET /api/locations/:id/export works for self-hosted without plan query', async () => {
    mockSelfHosted();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// API key routes
// ---------------------------------------------------------------------------

describe('API key route plan gating', () => {
  it('POST /api/api-keys returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Key' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('GET /api/api-keys is blocked for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('POST /api/api-keys works for cloud PRO user', async () => {
    mockProUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pro Key' });

    expect(res.status).toBe(201);
    expect(res.body.key).toBeDefined();
  });

  it('POST /api/api-keys works for self-hosted without plan query', async () => {
    mockSelfHosted();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Self-Hosted Key' });

    expect(res.status).toBe(201);
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Custom field routes
// ---------------------------------------------------------------------------

describe('Custom field route plan gating', () => {
  it('POST /api/locations/:id/custom-fields returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/custom-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Size' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('GET /api/locations/:id/custom-fields works for cloud FREE user (read is not gated)', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/custom-fields`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('DELETE /api/locations/:id/custom-fields/:fieldId returns 403 PLAN_RESTRICTED for cloud FREE user', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .delete(`/api/locations/${location.id}/custom-fields/non-existent-field-id`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('POST /api/locations/:id/custom-fields works for cloud PRO user', async () => {
    mockProUser();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/custom-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Color' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Color');
  });

  it('POST /api/locations/:id/custom-fields works for self-hosted without plan query', async () => {
    mockSelfHosted();
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/custom-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Weight' });

    expect(res.status).toBe(201);
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });
});
