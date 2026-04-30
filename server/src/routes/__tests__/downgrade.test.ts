import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    isSubscriptionActive: vi.fn(),
    generateDowngradeFlowAction: vi.fn(),
  };
});

import { createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { generateDowngradeFlowAction, getUserPlanInfo, isSelfHosted, isSubscriptionActive, Plan, SubStatus } from '../../lib/planGate.js';

let app: Express;

function mockActivePlusPaidUser() {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PLUS,
    subStatus: SubStatus.ACTIVE,
    activeUntil: '2026-05-27T00:00:00Z',
    email: 'plus@example.com',
    previousSubStatus: null,
    cancelAtPeriodEnd: null,
    billingPeriod: 'quarterly',
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
    billingPeriod: 'quarterly',
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
}

function mockLapsedUser() {
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
  vi.mocked(generateDowngradeFlowAction).mockReset();
  vi.mocked(generateDowngradeFlowAction).mockResolvedValue({
    url: 'https://billing.example.com/portal-flow',
    method: 'POST',
    fields: { token: 'jwt-stub', targetPlan: 'free' },
  });
});

describe('POST /api/plan/downgrade', () => {
  it('returns portalFlowAction for active Plus -> Free', async () => {
    const { user, token } = await createTestUser(app);
    mockActivePlusPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });

    expect(res.status).toBe(200);
    expect(res.body.portalFlowAction).toEqual({
      url: 'https://billing.example.com/portal-flow',
      method: 'POST',
      fields: { token: 'jwt-stub', targetPlan: 'free' },
    });
    expect(generateDowngradeFlowAction).toHaveBeenCalledWith(user.id, 'plus@example.com', 'free');
  });

  it('returns portalFlowAction for active Pro -> Plus', async () => {
    const { user, token } = await createTestUser(app);
    mockActiveProPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'plus' });

    expect(res.status).toBe(200);
    expect(res.body.portalFlowAction).toBeDefined();
    expect(generateDowngradeFlowAction).toHaveBeenCalledWith(user.id, 'pro@example.com', 'plus');
  });

  it('returns portalFlowAction for active Pro -> Free', async () => {
    const { token } = await createTestUser(app);
    mockActiveProPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });

    expect(res.status).toBe(200);
    expect(res.body.portalFlowAction).toBeDefined();
  });

  it('handles lapsed user -> free directly without a portal action', async () => {
    const { token } = await createTestUser(app);
    mockLapsedUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'free' });

    expect(res.status).toBe(200);
    expect(res.body.portalFlowAction).toBeUndefined();
    expect(res.body.plan).toBeDefined();
    expect(generateDowngradeFlowAction).not.toHaveBeenCalled();
  });

  it('rejects lapsed user trying to downgrade to plus (not free)', async () => {
    const { token } = await createTestUser(app);
    mockLapsedUser();
    vi.mocked(getUserPlanInfo).mockResolvedValueOnce({
      plan: Plan.PRO,
      subStatus: SubStatus.INACTIVE,
      activeUntil: '2026-04-15T00:00:00Z',
      email: 'lapsed@example.com',
      previousSubStatus: SubStatus.ACTIVE,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
    });

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'plus' });

    expect(res.status).toBe(422);
  });

  it('rejects invalid targetPlan', async () => {
    const { token } = await createTestUser(app);
    mockActivePlusPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'enterprise' });

    expect(res.status).toBe(422);
  });

  it('rejects upgrade direction (plus -> pro)', async () => {
    const { token } = await createTestUser(app);
    mockActivePlusPaidUser();

    const res = await request(app)
      .post('/api/plan/downgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPlan: 'pro' });

    expect(res.status).toBe(422);
  });
});
