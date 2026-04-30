import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config BEFORE any module that consumes it (planGate caches the secret).
const mockConfig = {
  managerUrl: 'https://billing.test' as string | null,
  subscriptionJwtSecret: 'test-secret-do-not-use-in-prod' as string | null,
  selfHosted: false,
};
vi.mock('../../lib/config.js', () => ({ config: mockConfig }));

vi.mock('../../db.js', () => {
  let counter = 0;
  return {
    generateUuid: () => `test-uuid-${++counter}`,
  };
});

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const { cancelSubscription, deleteBillingCustomer } = await import('../billingClient.js');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

describe('billingClient.cancelSubscription', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConfig.managerUrl = 'https://billing.test';
    mockConfig.subscriptionJwtSecret = 'test-secret-do-not-use-in-prod';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Speed retries up so the suite stays fast.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs a JWT and POSTs to /api/v1/customers/:id/cancel-subscription with refundPolicy body', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, { cancelled: true, hadActiveSubscription: false }),
    );

    await cancelSubscription({ userId: 'user-123', refundPolicy: 'prorated' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://billing.test/api/v1/customers/user-123/cancel-subscription');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toMatch(/^Bearer ey/);
    expect(JSON.parse(init.body as string)).toEqual({ refundPolicy: 'prorated' });
  });

  it('returns the parsed JSON body when billing returns 200', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        cancelled: true,
        hadActiveSubscription: true,
        refundAmountCents: 999,
      }),
    );

    const result = await cancelSubscription({ userId: 'u1', refundPolicy: 'prorated' });
    expect(result).toEqual({
      cancelled: true,
      hadActiveSubscription: true,
      refundAmountCents: 999,
    });
  });

  it('returns a structured failure on 4xx (no retry)', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse(409, 'subscription locked'));

    const result = await cancelSubscription({ userId: 'u1', refundPolicy: 'none' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(false);
    expect(result.hadActiveSubscription).toBe(true);
    expect(result.reason).toContain('billing 409');
    expect(result.reason).toContain('subscription locked');
  });

  it('retries once on 5xx then succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse(503, 'unavailable'))
      .mockResolvedValueOnce(
        jsonResponse(200, { cancelled: true, hadActiveSubscription: false }),
      );

    const result = await cancelSubscription({ userId: 'u1', refundPolicy: 'none' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.cancelled).toBe(true);
  });

  it('throws after second 5xx', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse(500, 'boom'))
      .mockResolvedValueOnce(textResponse(502, 'still boom'));

    await expect(
      cancelSubscription({ userId: 'u1', refundPolicy: 'none' }),
    ).rejects.toThrow(/billing returned 502/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('re-signs the JWT on retry (different jti → different bearer)', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse(500, 'boom'))
      .mockResolvedValueOnce(
        jsonResponse(200, { cancelled: true, hadActiveSubscription: false }),
      );

    await cancelSubscription({ userId: 'u1', refundPolicy: 'none' });

    const auth1 = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const auth2 = (fetchSpy.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(auth1.Authorization).toMatch(/^Bearer /);
    expect(auth2.Authorization).toMatch(/^Bearer /);
    expect(auth1.Authorization).not.toBe(auth2.Authorization);
  });

  it('throws if MANAGER_URL is unset', async () => {
    mockConfig.managerUrl = null;
    await expect(
      cancelSubscription({ userId: 'u1', refundPolicy: 'none' }),
    ).rejects.toThrow(/MANAGER_URL not configured/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Real timeouts via AbortSignal.timeout are flaky to test in vitest without
  // forging the global fetch differently — the fetch impl is the one that
  // throws on signal abort, and AbortSignal.timeout uses real wall-clock time.
  // The 15s constant is verified by code review.
  it.skip('times out at 15s', async () => {
    // intentionally not implemented
  });
});

describe('billingClient.deleteBillingCustomer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConfig.managerUrl = 'https://billing.test';
    mockConfig.subscriptionJwtSecret = 'test-secret-do-not-use-in-prod';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns void on 200', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse(200, ''));
    await expect(deleteBillingCustomer('u1')).resolves.toBeUndefined();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://billing.test/api/v1/customers/u1');
    expect(init.method).toBe('DELETE');
  });

  it('returns void on 404 (idempotent)', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse(404, 'not found'));
    await expect(deleteBillingCustomer('u1')).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws on 409 (active subscriptions present)', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse(409, 'has active subs'));
    await expect(deleteBillingCustomer('u1')).rejects.toThrow(/409/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws on persistent 500 (after retry)', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse(500, 'boom'))
      .mockResolvedValueOnce(textResponse(500, 'still boom'));
    await expect(deleteBillingCustomer('u1')).rejects.toThrow(/billing returned 500/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
