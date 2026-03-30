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
    generateUpgradeUrl: vi.fn(),
    getFeatureMap: vi.fn(),
  };
});

// ---- Imports (after mocks) ----

import { createApp } from '../index.js';
import { generateUpgradeUrl, getFeatureMap, getUserPlanInfo, isSelfHosted, Plan, SubStatus } from '../lib/planGate.js';
import { createTestUser } from './helpers.js';

let app: Express;

const PRO_FEATURES = {
  ai: true,
  apiKeys: true,
  customFields: true,
  fullExport: true,
  reorganize: true,
  binSharing: true,
  maxLocations: null,
  maxPhotoStorageMb: 5000,
  maxMembersPerLocation: null,
  activityRetentionDays: 90,
};

const LITE_FEATURES = {
  ai: false,
  apiKeys: false,
  customFields: false,
  fullExport: false,
  reorganize: false,
  binSharing: false,
  maxLocations: 1,
  maxPhotoStorageMb: 100,
  maxMembersPerLocation: 1,
  activityRetentionDays: 90,
};

beforeEach(() => {
  app = createApp();
  vi.mocked(isSelfHosted).mockReset();
  vi.mocked(getUserPlanInfo).mockReset();
  vi.mocked(generateUpgradeUrl).mockReset();
  vi.mocked(getFeatureMap).mockReset();
});

describe('GET /api/plan', () => {
  it('requires authentication (401 without token)', async () => {
    const res = await request(app).get('/api/plan');
    expect(res.status).toBe(401);
  });

  it('returns pro + selfHosted when self-hosted', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(true);
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.status).toBe('active');
    expect(res.body.selfHosted).toBe(true);
    expect(res.body.activeUntil).toBeNull();
    expect(res.body.upgradeUrl).toBeNull();
    expect(res.body.features).toBeDefined();
    expect(res.body.features.ai).toBe(true);
    expect(res.body.features.maxLocations).toBeNull();
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });

  it('returns correct info for cloud pro user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PRO,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'pro@example.com',
      previousSubStatus: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.status).toBe('active');
    expect(res.body.selfHosted).toBe(false);
    expect(res.body.activeUntil).toBeNull();
    expect(res.body.upgradeUrl).toBeNull();
    expect(res.body.features.ai).toBe(true);
    expect(res.body.features.maxLocations).toBeNull();
  });

  it('returns trial status + upgradeUrl for cloud pro user on trial', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PRO,
      subStatus: SubStatus.TRIAL,
      activeUntil: '2027-01-01T00:00:00.000Z',
      email: 'trial@example.com',
      previousSubStatus: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/auth/openbin?token=trial');
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.status).toBe('trial');
    expect(res.body.activeUntil).toBe('2027-01-01T00:00:00.000Z');
    expect(res.body.upgradeUrl).toBe('https://manager.example.com/auth/openbin?token=trial');
  });

  it('returns restricted features + upgradeUrl for cloud lite user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.LITE,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'lite@example.com',
      previousSubStatus: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(LITE_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/auth/openbin?token=abc');
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('lite');
    expect(res.body.status).toBe('active');
    expect(res.body.selfHosted).toBe(false);
    expect(res.body.upgradeUrl).toBe('https://manager.example.com/auth/openbin?token=abc');
    expect(res.body.features.ai).toBe(false);
    expect(res.body.features.maxLocations).toBe(1);
  });

  it('returns inactive status for cloud user with no subscription', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.LITE,
      subStatus: SubStatus.INACTIVE,
      activeUntil: null,
      email: 'inactive@example.com',
      previousSubStatus: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(LITE_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('lite');
    expect(res.body.status).toBe('inactive');
  });

  it('returns 404 when getUserPlanInfo returns null', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue(null);
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
