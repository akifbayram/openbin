import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----

vi.mock('../lib/planGate.js', () => ({
  isSelfHosted: vi.fn(),
  getUserPlanInfo: vi.fn(),
  isProUser: vi.fn(),
  isSubscriptionActive: vi.fn(),
  generateUpgradeUrl: vi.fn(),
  // Middleware migrated to the structured CheckoutAction API in 2026-04-26.
  // The action mock returns a POST shape; renderActionAsUrl is mocked to
  // echo the URL field so existing assertions on `upgradeUrl` keep working.
  generateUpgradeAction: vi.fn(),
  renderActionAsUrl: vi.fn((action: { url: string } | null) => action?.url ?? null),
}));

// ---- Imports (after mocks) ----

import { PlanRestrictedError } from '../lib/httpErrors.js';
import {
  generateUpgradeAction,
  generateUpgradeUrl,
  getUserPlanInfo,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
} from '../lib/planGate.js';
import { requirePro } from '../middleware/requirePlan.js';

// ---- Helpers ----

function makeReq(userId = 'user-123'): Partial<Request> {
  return { user: { id: userId, email: 'testuser@test.local' } };
}

function makeRes(): Partial<Response> {
  return { locals: {} } as Partial<Response>;
}

/** Run the middleware and return the first argument passed to next(). */
function runMiddleware(
  handler: ReturnType<typeof requirePro>,
  req: Partial<Request> = makeReq(),
): Promise<unknown> {
  const res = makeRes();
  return new Promise((resolve) => {
    const next = ((err?: unknown) => resolve(err)) as NextFunction;
    handler(req as Request, res as Response, next);
  });
}

// ---- Tests: requirePro ----

describe('requirePro()', () => {
  beforeEach(() => {
    vi.mocked(isSelfHosted).mockReset();
    vi.mocked(getUserPlanInfo).mockReset();
    vi.mocked(isProUser).mockReset();
    vi.mocked(isSubscriptionActive).mockReset();
    vi.mocked(generateUpgradeUrl).mockReset();
    vi.mocked(generateUpgradeAction).mockReset();
    // Default action mock returns null; tests that need a URL use the
    // upgradeAction helper below to set both action + URL together.
    vi.mocked(generateUpgradeAction).mockResolvedValue(null);
  });

  // Build a CheckoutAction that, when run through the (mocked, identity)
  // renderActionAsUrl, yields the given URL string. Tests can keep
  // asserting against `(error).upgradeUrl` without learning the new shape.
  function actionWithUrl(url: string | null): { url: string; method: 'POST'; fields: Record<string, string> } | null {
    return url ? { url, method: 'POST', fields: {} } : null;
  }

  it('calls next() immediately for self-hosted without DB query', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(true);

    const error = await runMiddleware(requirePro());

    expect(error).toBeUndefined();
    expect(getUserPlanInfo).not.toHaveBeenCalled();
  });

  it('calls next() for cloud PRO + ACTIVE user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: 1,
      subStatus: 1,
      activeUntil: null,
      email: 'pro@example.com',
      previousSubStatus: null,
    });
    vi.mocked(isSubscriptionActive).mockReturnValue(true);
    vi.mocked(isProUser).mockReturnValue(true);

    const error = await runMiddleware(requirePro());

    expect(error).toBeUndefined();
    expect(getUserPlanInfo).toHaveBeenCalledWith('user-123');
  });

  it('throws PlanRestrictedError for cloud LITE user', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: 0,
      subStatus: 1,
      activeUntil: null,
      email: 'lite@example.com',
      previousSubStatus: null,
    });
    vi.mocked(isSubscriptionActive).mockReturnValue(true);
    vi.mocked(isProUser).mockReturnValue(false);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));

    const error = await runMiddleware(requirePro());

    expect(error).toBeInstanceOf(PlanRestrictedError);
    expect((error as PlanRestrictedError).message).toBe('This feature requires a Pro plan');
    expect((error as PlanRestrictedError).statusCode).toBe(403);
  });

  it('throws PlanRestrictedError for expired subscription', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: 1,
      subStatus: 1,
      activeUntil: '2020-01-01T00:00:00.000Z',
      email: 'expired@example.com',
      previousSubStatus: null,
    });
    vi.mocked(isSubscriptionActive).mockReturnValue(false);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(null));

    const error = await runMiddleware(requirePro());

    expect(error).toBeInstanceOf(PlanRestrictedError);
    expect((error as PlanRestrictedError).message).toBe('Your subscription has expired');
    expect((error as PlanRestrictedError).statusCode).toBe(403);
  });

  it('throws PlanRestrictedError when user plan not found', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue(null);

    const error = await runMiddleware(requirePro());

    expect(error).toBeInstanceOf(PlanRestrictedError);
    expect((error as PlanRestrictedError).message).toBe('User plan not found');
  });

  it('includes upgrade_url in error when managerUrl is configured', async () => {
    const upgradeUrl = 'https://manager.example.com/auth/openbin?token=abc';
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: 0,
      subStatus: 1,
      activeUntil: null,
      email: 'lite@example.com',
      previousSubStatus: null,
    });
    vi.mocked(isSubscriptionActive).mockReturnValue(true);
    vi.mocked(isProUser).mockReturnValue(false);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(upgradeUrl);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(upgradeUrl));

    const error = await runMiddleware(requirePro());

    expect(error).toBeInstanceOf(PlanRestrictedError);
    expect((error as PlanRestrictedError).upgradeUrl).toBe(upgradeUrl);
    // Middleware now derives URL from the structured action; the URL helper
    // is invoked transparently. Assert the action call instead.
    expect(generateUpgradeAction).toHaveBeenCalledWith('user-123', 'lite@example.com');
  });

  it('includes upgrade_url in expired subscription error', async () => {
    const upgradeUrl = 'https://manager.example.com/auth/openbin?token=xyz';
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: 1,
      subStatus: 1,
      activeUntil: '2020-01-01T00:00:00.000Z',
      email: 'expired@example.com',
      previousSubStatus: null,
    });
    vi.mocked(isSubscriptionActive).mockReturnValue(false);
    vi.mocked(generateUpgradeUrl).mockResolvedValue(upgradeUrl);
    vi.mocked(generateUpgradeAction).mockResolvedValue(actionWithUrl(upgradeUrl));

    const error = await runMiddleware(requirePro());

    expect(error).toBeInstanceOf(PlanRestrictedError);
    expect((error as PlanRestrictedError).upgradeUrl).toBe(upgradeUrl);
  });
});
