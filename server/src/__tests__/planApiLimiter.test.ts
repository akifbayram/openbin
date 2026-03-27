import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    isProUser: vi.fn(),
  };
});

import { getUserPlanInfo, isProUser, isSelfHosted, Plan, SubStatus } from '../lib/planGate.js';
import { createPlanApiLimiter } from '../lib/rateLimiters.js';

function buildApp(limiter: RequestHandler, userId?: string) {
  const app = express();
  if (userId) {
    app.use((req, _res, next) => {
      req.user = { id: userId, username: 'testuser' };
      next();
    });
  }
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('planApiLimiter', () => {
  beforeEach(() => {
    vi.mocked(isSelfHosted).mockReset();
    vi.mocked(getUserPlanInfo).mockReset();
    vi.mocked(isProUser).mockReset();
  });

  it('returns noop middleware when self-hosted', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(true);
    const limiter = createPlanApiLimiter();
    const app = buildApp(limiter, 'user-1');

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-policy']).toBeUndefined();
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });

  it('enforces 1000/hr limit for cloud pro users', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.PRO,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: null,
    });
    vi.mocked(isProUser).mockReturnValue(true);
    const limiter = createPlanApiLimiter();
    const app = buildApp(limiter, 'user-pro');

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('1000');
  });

  it('enforces 200/hr limit for cloud lite users', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    vi.mocked(getUserPlanInfo).mockResolvedValue({
      plan: Plan.LITE,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: null,
    });
    vi.mocked(isProUser).mockReturnValue(false);
    const limiter = createPlanApiLimiter();
    const app = buildApp(limiter, 'user-lite');

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('200');
  });

  it('skips unauthenticated requests', async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    const limiter = createPlanApiLimiter();
    const app = buildApp(limiter);

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-policy']).toBeUndefined();
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});
