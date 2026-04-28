import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----
// Note: getFeatureMap is mocked too — in the test env config.selfHosted
// defaults to true, which makes the real getFeatureMap return UNRESTRICTED
// for every plan. Mocking it lets us simulate cloud-tier feature maps
// (with non-null maxBins etc.) so the downgrade impact has something to
// warn about.
vi.mock('../../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    getUserUsage: vi.fn(),
    getFeatureMap: vi.fn(),
  };
});

// ---- Imports (after mocks) ----
import { createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { getFeatureMap, getUserPlanInfo, getUserUsage, isSelfHosted, Plan, type PlanFeatures, SubStatus } from '../../lib/planGate.js';

let app: Express;

const FREE_FEATURES: PlanFeatures = {
  ai: true, apiKeys: false, customFields: false, fullExport: false,
  reorganize: false, binSharing: false, attachments: false,
  maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0,
  maxMembersPerLocation: 1, activityRetentionDays: 7,
  aiCreditsPerMonth: 10, reorganizeMaxBins: null,
};
const PLUS_FEATURES: PlanFeatures = {
  ai: true, apiKeys: false, customFields: false, fullExport: true,
  reorganize: true, binSharing: false, attachments: false,
  maxBins: 100, maxLocations: 1, maxPhotoStorageMb: 100,
  maxMembersPerLocation: 1, activityRetentionDays: 30,
  aiCreditsPerMonth: 25, reorganizeMaxBins: 10,
};
const PRO_FEATURES: PlanFeatures = {
  ai: true, apiKeys: true, customFields: true, fullExport: true,
  reorganize: true, binSharing: true, attachments: true,
  maxBins: 1000, maxLocations: 10, maxPhotoStorageMb: 5000,
  maxMembersPerLocation: 10, activityRetentionDays: 365,
  aiCreditsPerMonth: 250, reorganizeMaxBins: 50,
};

function setupFeatureMap() {
  vi.mocked(getFeatureMap).mockImplementation((plan) => {
    if (plan === Plan.PRO) return PRO_FEATURES;
    if (plan === Plan.PLUS) return PLUS_FEATURES;
    return FREE_FEATURES;
  });
}

function mockProUserWithUsage(usage: Partial<Awaited<ReturnType<typeof getUserUsage>>> = {}) {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  setupFeatureMap();
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PRO,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'pro@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
  });
  vi.mocked(getUserUsage).mockResolvedValue({
    binCount: 47,
    locationCount: 3,
    photoStorageMb: 0,
    memberCounts: {},
    photoCount: 0,
    ...usage,
  });
}

function mockFreeUser() {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  setupFeatureMap();
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.FREE,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'free@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
  });
  vi.mocked(getUserUsage).mockResolvedValue({
    binCount: 0, locationCount: 1, photoStorageMb: 0, memberCounts: {}, photoCount: 0,
  });
}

beforeEach(() => {
  app = createApp();
  vi.mocked(isSelfHosted).mockReset();
  vi.mocked(getUserPlanInfo).mockReset();
  vi.mocked(getUserUsage).mockReset();
  vi.mocked(getFeatureMap).mockReset();
});

describe('POST /api/plan/downgrade-impact', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/plan/downgrade-impact')
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(401);
  });

  it('returns warnings for valid Pro -> Free downgrade', async () => {
    mockProUserWithUsage();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/plan/downgrade-impact')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(200);
    expect(res.body.targetPlan).toBe('free');
    expect(res.body.warnings.length).toBeGreaterThan(0);
    expect(res.body.warnings.some((w: { title: string }) => w.title.startsWith('47 bins'))).toBe(true);
  });

  it('rejects invalid target plan', async () => {
    mockProUserWithUsage();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/plan/downgrade-impact')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'enterprise' });
    // ValidationError yields 422 in this codebase (see lib/httpErrors.ts).
    expect(res.status).toBe(422);
  });

  it('rejects upgrade direction (free -> plus)', async () => {
    mockFreeUser();
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/plan/downgrade-impact')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'plus' });
    expect(res.status).toBe(422);
  });
});
