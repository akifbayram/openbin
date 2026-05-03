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
    generateUpgradePlanUrl: vi.fn(),
    generatePortalUrl: vi.fn(),
    // CheckoutAction-shaped variants. The route was migrated in the
    // 2026-04-26 hardening pass to call these and derive the *Url fields
    // from them via renderActionAsUrl. We mock renderActionAsUrl to be
    // identity over `action.url` so existing res.body.*Url assertions
    // keep working unchanged.
    generateUpgradeAction: vi.fn(),
    generateUpgradePlanAction: vi.fn(),
    generatePortalAction: vi.fn(),
    renderActionAsUrl: vi.fn((action: { url: string } | null) => action?.url ?? null),
    getFeatureMap: vi.fn(),
    getAiCredits: vi.fn(),
  };
});

// ---- Imports (after mocks) ----

import { createApp } from '../index.js';
import { generatePortalAction, generatePortalUrl, generateUpgradeAction, generateUpgradePlanAction, generateUpgradePlanUrl, generateUpgradeUrl, getAiCredits, getFeatureMap, getUserPlanInfo, isSelfHosted, Plan, SubStatus } from '../lib/planGate.js';
import { createTestUser } from './helpers.js';

// Build a CheckoutAction whose mocked renderActionAsUrl returns the given
// URL string. Lets each test carry on asserting on res.body.upgradeUrl etc.
// while the route now derives those URLs from these action mocks.
function actionWithUrl(url: string | null): { url: string; method: 'POST'; fields: Record<string, string> } | null {
  return url ? { url, method: 'POST', fields: {} } : null;
}

let app: Express;

const PRO_FEATURES = {
  ai: true,
  apiKeys: true,
  customFields: true,
  fullExport: true,
  reorganize: true,
  binSharing: true,
  attachments: true,
  maxBins: 1000,
  maxLocations: 10,
  maxPhotoStorageMb: 1024,
  maxMembersPerLocation: 10,
  activityRetentionDays: 90,
  aiCreditsPerMonth: 250,
  reorganizeMaxBins: 40,
};

const PLUS_FEATURES = {
  ai: true,
  apiKeys: false,
  customFields: false,
  fullExport: true,
  reorganize: true,
  binSharing: false,
  attachments: false,
  maxBins: 100,
  maxLocations: 1,
  maxPhotoStorageMb: 100,
  maxMembersPerLocation: 1,
  activityRetentionDays: 30,
  aiCreditsPerMonth: 25,
  reorganizeMaxBins: 10,
};

beforeEach(() => {
  app = createApp();
  vi.mocked(isSelfHosted).mockReset();
  vi.mocked(getUserPlanInfo).mockReset();
  vi.mocked(generateUpgradeUrl).mockReset();
  vi.mocked(generateUpgradePlanUrl).mockReset();
  vi.mocked(generatePortalUrl).mockReset();
  vi.mocked(generateUpgradeAction).mockReset();
  vi.mocked(generateUpgradePlanAction).mockReset();
  vi.mocked(generatePortalAction).mockReset();
  vi.mocked(generateUpgradeAction).mockResolvedValue(null);
  vi.mocked(generateUpgradePlanAction).mockResolvedValue(null);
  vi.mocked(generatePortalAction).mockResolvedValue(null);
  vi.mocked(getFeatureMap).mockReset();
  vi.mocked(getAiCredits).mockReset();
  vi.mocked(getAiCredits).mockResolvedValue({ used: 0, limit: 0, resetsAt: null });
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
    expect(res.body.features.maxLocations).toBe(10);
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
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));
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
    expect(res.body.features.maxLocations).toBe(10);
  });

  it('returns trial status + upgradeUrl for cloud plus user on trial', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.TRIAL,
      activeUntil: '2027-01-01T00:00:00.000Z',
      email: 'trial@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/auth/openbin?token=trial');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/auth/openbin?token=trial'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('plus');
    expect(res.body.status).toBe('trial');
    expect(res.body.activeUntil).toBe('2027-01-01T00:00:00.000Z');
    expect(res.body.upgradeUrl).toBe('https://manager.example.com/auth/openbin?token=trial');
  });

  it('returns restricted features + upgradeUrl for cloud plus user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'plus@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/auth/openbin?token=abc');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/auth/openbin?token=abc'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('plus');
    expect(res.body.status).toBe('active');
    expect(res.body.selfHosted).toBe(false);
    expect(res.body.upgradeUrl).toBe('https://manager.example.com/auth/openbin?token=abc');
    expect(res.body.features.ai).toBe(true);
    expect(res.body.features.maxLocations).toBe(1);
  });

  it('returns inactive status for cloud user with no subscription', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.INACTIVE,
      activeUntil: null,
      email: 'inactive@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('plus');
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

  it('returns subscribePlanUrl (not upgradePlusUrl) for Plus trial user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.TRIAL,
      activeUntil: '2027-01-01T00:00:00.000Z',
      email: 'trial@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout'));
    vi.mocked(generatePortalUrl).mockResolvedValue(null);
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradePlusUrl).toBeNull();
    expect(res.body.subscribePlanUrl).toBe('https://manager.example.com/checkout');
    expect(res.body.upgradeProUrl).toBe('https://manager.example.com/checkout');
    expect(res.body.portalUrl).toBeNull();
  });

  it('returns upgradeProUrl and portalUrl for Plus active user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'plus@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout-pro');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout-pro'));
    vi.mocked(generatePortalUrl).mockResolvedValue('https://manager.example.com/portal');
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl('https://manager.example.com/portal'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradePlusUrl).toBeNull();
    expect(res.body.upgradeProUrl).toBe('https://manager.example.com/checkout-pro');
    expect(res.body.subscribePlanUrl).toBeNull();
    expect(res.body.portalUrl).toBe('https://manager.example.com/portal');
  });

  it('returns only portalUrl for Pro active user (no upgrade URLs)', async () => {
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
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl(null));
    vi.mocked(generatePortalUrl).mockResolvedValue('https://manager.example.com/portal');
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl('https://manager.example.com/portal'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradePlusUrl).toBeNull();
    expect(res.body.upgradeProUrl).toBeNull();
    expect(res.body.subscribePlanUrl).toBeNull();
    expect(res.body.portalUrl).toBe('https://manager.example.com/portal');
  });

  it('returns canDowngradeToFree=true for Plus trial user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.TRIAL,
      activeUntil: '2027-01-01T00:00:00.000Z',
      email: 'trial@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canDowngradeToFree).toBe(true);
  });

  it('returns canDowngradeToFree=true for locked post-trial user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.INACTIVE,
      activeUntil: null,
      email: 'expired@example.com',
      previousSubStatus: SubStatus.TRIAL,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout-plus');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout-plus'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canDowngradeToFree).toBe(true);
  });

  it('returns canDowngradeToFree=false for Free user', async () => {
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
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockImplementation(async (_uid, _email, plan) =>
      `https://manager.example.com/checkout-${plan}`);
    vi.mocked(generatePortalUrl).mockResolvedValue(null);
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canDowngradeToFree).toBe(false);
  });

  it('returns canDowngradeToFree=false for active paid Plus user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'plus@example.com',
      previousSubStatus: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout-pro');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout-pro'));
    vi.mocked(generatePortalUrl).mockResolvedValue('https://manager.example.com/portal');
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl('https://manager.example.com/portal'));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canDowngradeToFree).toBe(false);
  });

  it('returns subscribePlanUrl and upgradeProUrl for expired Pro user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PRO,
      subStatus: SubStatus.INACTIVE,
      activeUntil: null,
      email: 'pro@example.com',
      previousSubStatus: SubStatus.ACTIVE,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PRO_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockResolvedValue('https://manager.example.com/checkout-pro');
    vi.mocked(generateUpgradePlanAction).mockResolvedValue(actionWithUrl('https://manager.example.com/checkout-pro'));
    vi.mocked(generatePortalUrl).mockResolvedValue(null);
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradeProUrl).toBe('https://manager.example.com/checkout-pro');
    expect(res.body.subscribePlanUrl).toBe('https://manager.example.com/checkout-pro');
    expect(res.body.upgradePlusUrl).toBeNull();
    expect(res.body.portalUrl).toBeNull();
    expect(res.body.canDowngradeToFree).toBe(true);
  });

  it('returns subscribePlanUrl and upgradePlusUrl for expired Plus user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PLUS,
      subStatus: SubStatus.INACTIVE,
      activeUntil: null,
      email: 'plus@example.com',
      previousSubStatus: SubStatus.ACTIVE,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockImplementation(async (_uid, _email, plan) =>
      `https://manager.example.com/checkout-${plan}`);
    vi.mocked(generateUpgradePlanAction).mockImplementation(async (_uid, _email, plan) =>
      actionWithUrl(`https://manager.example.com/checkout-${plan}`));
    vi.mocked(generatePortalUrl).mockResolvedValue(null);
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradePlusUrl).toBe('https://manager.example.com/checkout-plus');
    expect(res.body.upgradeProUrl).toBe('https://manager.example.com/checkout-pro');
    expect(res.body.subscribePlanUrl).toBe('https://manager.example.com/checkout-plus');
    expect(res.body.portalUrl).toBeNull();
    expect(res.body.canDowngradeToFree).toBe(true);
  });

  it('returns upgradePlusUrl and upgradeProUrl for Free user', async () => {
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
    vi.mocked(getFeatureMap).mockReturnValue(PLUS_FEATURES);
    vi.mocked(generateUpgradeUrl).mockResolvedValue('https://manager.example.com/upgrade');
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl('https://manager.example.com/upgrade'));
    vi.mocked(generateUpgradePlanUrl).mockImplementation(async (_uid, _email, plan) =>
      `https://manager.example.com/checkout-${plan}`);
    vi.mocked(generateUpgradePlanAction).mockImplementation(async (_uid, _email, plan) =>
      actionWithUrl(`https://manager.example.com/checkout-${plan}`));
    vi.mocked(generatePortalUrl).mockResolvedValue(null);
    vi.mocked(generatePortalAction).mockResolvedValue(actionWithUrl(null));
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upgradePlusUrl).toBe('https://manager.example.com/checkout-plus');
    expect(res.body.upgradeProUrl).toBe('https://manager.example.com/checkout-pro');
    expect(res.body.subscribePlanUrl).toBeNull();
    expect(res.body.portalUrl).toBeNull();
  });
});
