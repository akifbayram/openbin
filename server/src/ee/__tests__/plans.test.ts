import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/plans is gated by `if (!config.selfHosted)` in createApp(); the route is
// cloud-only. Tests assert the cloud behavior, so override selfHosted before
// the module graph captures the config value.
vi.mock('../../lib/config.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/config.js')>('../../lib/config.js');
  return { ...actual, config: { ...actual.config, selfHosted: false } };
});

const { createApp } = await import('../../index.js');

describe('GET /api/plans', () => {
  let app: Express;
  beforeEach(() => {
    app = createApp();
  });

  it('returns catalog without auth', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(3);
    expect(res.body.plans.map((p: any) => p.id)).toEqual(['free', 'plus', 'pro']);
  });

  it('responds with CORS headers for billing.openbin.app', async () => {
    const res = await request(app)
      .get('/api/plans')
      .set('Origin', 'https://billing.openbin.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://billing.openbin.app');
  });

  it('does not include marketing copy', async () => {
    const res = await request(app).get('/api/plans');
    for (const plan of res.body.plans) {
      expect(plan).not.toHaveProperty('tagline');
      expect(plan).not.toHaveProperty('description');
    }
  });

  it('plus plan has monthly + annual prices', async () => {
    const res = await request(app).get('/api/plans');
    const plus = res.body.plans.find((p: any) => p.id === 'plus');
    expect(plus.prices.monthly).toBeGreaterThan(0);
    expect(plus.prices.annual).toBeGreaterThan(0);
  });
});
