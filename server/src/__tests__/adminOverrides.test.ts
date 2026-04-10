import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { Plan, SubStatus } from '../lib/planGate.js';
import { createTestUser, makeAdmin } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

function setTrial(userId: string) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  getDb().prepare('UPDATE users SET sub_status = ?, active_until = ? WHERE id = ?').run(SubStatus.TRIAL, future, userId);
}

// ── Auth enforcement ────────────────────────────────────────────────────

describe('admin overrides auth', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/admin/overrides/overrides/fake-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const { token, user } = await createTestUser(app);
    const res = await request(app)
      .get(`/api/admin/overrides/overrides/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ── Overrides CRUD ──────────────────────────────────────────────────────

describe('GET /api/admin/overrides/overrides/:userId', () => {
  it('returns null fields when no overrides set', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(target.id);
    expect(res.body.maxBins).toBeNull();
    expect(res.body.aiEnabled).toBeNull();
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/overrides/overrides/nonexistent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/overrides/overrides/:userId', () => {
  it('sets overrides and retrieves them', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const putRes = await request(app)
      .put(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxBins: 100, aiEnabled: true });

    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.maxBins).toBe(100);
    expect(getRes.body.aiEnabled).toBe(true);
  });

  it('updates existing overrides via upsert', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    await request(app)
      .put(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxBins: 50 });

    await request(app)
      .put(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxBins: 200, maxLocations: 10 });

    const getRes = await request(app)
      .get(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.maxBins).toBe(200);
    expect(getRes.body.maxLocations).toBe(10);
  });
});

describe('DELETE /api/admin/overrides/overrides/:userId', () => {
  it('clears overrides', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    await request(app)
      .put(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxBins: 100 });

    const delRes = await request(app)
      .delete(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/admin/overrides/overrides/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.maxBins).toBeNull();
  });
});

// ── AI credits ──────────────────────────────────────────────────────────

describe('POST /api/admin/overrides/ai-credits/grant/:userId', () => {
  it('grants credits (reduces used count)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    getDb().prepare('UPDATE users SET ai_credits_used = 50 WHERE id = ?').run(target.id);

    const res = await request(app)
      .post(`/api/admin/overrides/ai-credits/grant/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 20 });

    expect(res.status).toBe(200);

    const row = getDb().prepare('SELECT ai_credits_used FROM users WHERE id = ?').get(target.id) as { ai_credits_used: number };
    expect(row.ai_credits_used).toBe(30);
  });

  it('clamps to 0 when granting more than used', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    getDb().prepare('UPDATE users SET ai_credits_used = 5 WHERE id = ?').run(target.id);

    await request(app)
      .post(`/api/admin/overrides/ai-credits/grant/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    const row = getDb().prepare('SELECT ai_credits_used FROM users WHERE id = ?').get(target.id) as { ai_credits_used: number };
    expect(row.ai_credits_used).toBe(0);
  });

  it('rejects invalid amount', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/ai-credits/grant/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 });

    expect(res.status).toBe(422);
  });

  it('rejects amount over 10000', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/ai-credits/grant/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10001 });

    expect(res.status).toBe(422);
  });
});

describe('POST /api/admin/overrides/ai-credits/reset/:userId', () => {
  it('resets credits to 0 and sets reset date', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    getDb().prepare('UPDATE users SET ai_credits_used = 99 WHERE id = ?').run(target.id);

    const res = await request(app)
      .post(`/api/admin/overrides/ai-credits/reset/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const row = getDb().prepare('SELECT ai_credits_used, ai_credits_reset_at FROM users WHERE id = ?').get(target.id) as { ai_credits_used: number; ai_credits_reset_at: string };
    expect(row.ai_credits_used).toBe(0);
    expect(row.ai_credits_reset_at).toBeTruthy();
  });
});

// ── Trial extension ─────────────────────────────────────────────────────

describe('POST /api/admin/overrides/extend-trial/:userId', () => {
  it('extends trial for user on trial', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);
    setTrial(target.id);

    const res = await request(app)
      .post(`/api/admin/overrides/extend-trial/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 14 });

    expect(res.status).toBe(200);
    expect(res.body.activeUntil).toBeTruthy();
  });

  it('rejects extension for non-trial user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/extend-trial/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 14 });

    expect(res.status).toBe(422);
  });

  it('rejects days > 90', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);
    setTrial(target.id);

    const res = await request(app)
      .post(`/api/admin/overrides/extend-trial/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 91 });

    expect(res.status).toBe(422);
  });
});

// ── Comp plan ───────────────────────────────────────────────────────────

describe('POST /api/admin/overrides/grant-comp/:userId', () => {
  it('grants comp plan', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/grant-comp/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: Plan.PRO, days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.activeUntil).toBeTruthy();

    const row = getDb().prepare('SELECT plan, sub_status FROM users WHERE id = ?').get(target.id) as { plan: number; sub_status: number };
    expect(row.plan).toBe(Plan.PRO);
    expect(row.sub_status).toBe(SubStatus.ACTIVE);
  });

  it('rejects invalid plan', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/grant-comp/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 99, days: 30 });

    expect(res.status).toBe(422);
  });

  it('rejects days > 365', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/grant-comp/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: Plan.PRO, days: 366 });

    expect(res.status).toBe(422);
  });
});

// ── Force downgrade ─────────────────────────────────────────────────────

describe('POST /api/admin/overrides/force-downgrade/:userId', () => {
  it('downgrades user plan', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    await request(app)
      .post(`/api/admin/overrides/grant-comp/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: Plan.PRO, days: 30 });

    const res = await request(app)
      .post(`/api/admin/overrides/force-downgrade/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: Plan.FREE });

    expect(res.status).toBe(200);

    const row = getDb().prepare('SELECT plan FROM users WHERE id = ?').get(target.id) as { plan: number };
    expect(row.plan).toBe(Plan.FREE);
  });

  it('rejects invalid plan value', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/overrides/force-downgrade/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: -1 });

    expect(res.status).toBe(422);
  });
});

// ── AI usage report ─────────────────────────────────────────────────────

describe('GET /api/admin/overrides/ai-usage/:userId', () => {
  it('returns usage report', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/admin/overrides/ai-usage/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('creditsUsed');
    expect(res.body).toHaveProperty('creditsLimit');
    expect(res.body).toHaveProperty('dailyUsage');
    expect(Array.isArray(res.body.dailyUsage)).toBe(true);
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/overrides/ai-usage/nonexistent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
