import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks ----
vi.mock('../../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    isSubscriptionActive: vi.fn(),
  };
});

vi.mock('../../lib/billingClient.js', () => ({
  postBillingDowngrade: vi.fn(async (req: { targetPlan: string }) => ({
    ok: true,
    cancelAtPeriodEnd: '2026-05-27T00:00:00Z',
    effectiveAt: req.targetPlan === 'free' ? 'period-end' : 'now',
  })),
}));

import { createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { postBillingDowngrade } from '../../lib/billingClient.js';
import { BillingNotConfiguredError } from '../../lib/httpErrors.js';
import { getUserPlanInfo, isSelfHosted, isSubscriptionActive, Plan, SubStatus } from '../../lib/planGate.js';

let app: Express;

function mockActivePlusPaidUser(_userId: string) {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PLUS,
    subStatus: SubStatus.ACTIVE,
    activeUntil: '2026-05-27T00:00:00Z',
    email: 'plus@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: 'monthly',
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
}

function mockActiveProPaidUser() {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PRO,
    subStatus: SubStatus.ACTIVE,
    activeUntil: '2026-05-27T00:00:00Z',
    email: 'pro@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: 'monthly',
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
}

function mockLapsedUser(_userId: string) {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PLUS,
    subStatus: SubStatus.INACTIVE,
    activeUntil: '2026-04-15T00:00:00Z',
    email: 'lapsed@example.com',
    previousSubStatus: SubStatus.ACTIVE,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(false);
}

beforeEach(() => {
  app = createApp();
  vi.mocked(isSelfHosted).mockReset();
  vi.mocked(getUserPlanInfo).mockReset();
  vi.mocked(isSubscriptionActive).mockReset();
  vi.mocked(postBillingDowngrade).mockClear();
});

describe('POST /api/plan/downgrade', () => {
  it('forwards active Plus -> Free to billing service', async () => {
    const { user, token } = await createTestUser(app);
    mockActivePlusPaidUser(user.id);

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(200);
    expect(postBillingDowngrade).toHaveBeenCalledWith({ userId: user.id, targetPlan: 'free' });
  });

  it('returns updated PlanInfo on success', async () => {
    const { user, token } = await createTestUser(app);
    mockActivePlusPaidUser(user.id);

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.body.plan).toBeDefined();
  });

  it('rejects invalid targetPlan', async () => {
    const { user, token } = await createTestUser(app);
    mockActivePlusPaidUser(user.id);

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'enterprise' });
    expect(res.status).toBe(422); // ValidationError = 422 (codebase convention from Task 4)
  });

  it('rejects upgrade direction (plus -> pro)', async () => {
    const { user, token } = await createTestUser(app);
    mockActivePlusPaidUser(user.id);

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'pro' });
    expect(res.status).toBe(422);
  });

  it('handles lapsed user -> free directly without calling billing', async () => {
    const { user, token } = await createTestUser(app);
    mockLapsedUser(user.id);

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(200);
    expect(postBillingDowngrade).not.toHaveBeenCalled();
  });

  it('forwards active Pro -> Plus to billing service', async () => {
    const { user, token } = await createTestUser(app);
    mockActiveProPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'plus' });
    expect(res.status).toBe(200);
    expect(postBillingDowngrade).toHaveBeenCalledWith({ userId: user.id, targetPlan: 'plus' });
  });

  it('forwards active Pro -> Free to billing service', async () => {
    const { user, token } = await createTestUser(app);
    mockActiveProPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(200);
    expect(postBillingDowngrade).toHaveBeenCalledWith({ userId: user.id, targetPlan: 'free' });
  });

  it('returns 503 BILLING_NOT_CONFIGURED when billing client throws BillingNotConfiguredError', async () => {
    const { token } = await createTestUser(app);
    mockActivePlusPaidUser('');
    vi.mocked(postBillingDowngrade).mockRejectedValueOnce(
      new BillingNotConfiguredError('BILLING_INTERNAL_URL or BILLING_INTERNAL_KEY not configured'),
    );

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('BILLING_NOT_CONFIGURED');
  });
});
