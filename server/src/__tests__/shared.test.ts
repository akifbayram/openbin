import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { createShare, createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

async function setup() {
  const user = await createTestUser(app);
  const location = await createTestLocation(app, user.token);
  const bin = await createTestBin(app, user.token, location.id);
  return { user, location, bin };
}

// ── GET /api/shared/:token ──────────────────────────────────────────────

describe('GET /api/shared/:token', () => {
  it('returns bin data without authentication', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);
    expect(shareRes.status).toBe(201);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(bin.name);
    expect(res.body.shareToken).toBe(shareRes.body.token);
    expect(res.body.photos).toBeInstanceOf(Array);
    // Internal IDs should be stripped from shared response
    expect(res.body.id).toBeUndefined();
    expect(res.body.area_id).toBeUndefined();
  });

  it('returns 404 for invalid token', async () => {
    const res = await request(app).get('/api/shared/invalid-token');
    expect(res.status).toBe(404);
  });

  it('returns 404 for revoked share', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    await request(app)
      .delete(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when bin is deleted', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when bin is set to private', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    // Set bin to private — resolveShare filters out private bins
    getDb().prepare("UPDATE bins SET visibility = 'private' WHERE id = ?").run(bin.id);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(404);
  });

  it('increments view count on each access', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);
    const shareToken = shareRes.body.token;

    await request(app).get(`/api/shared/${shareToken}`);
    await request(app).get(`/api/shared/${shareToken}`);
    await request(app).get(`/api/shared/${shareToken}`);

    const infoRes = await request(app)
      .get(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(infoRes.body.viewCount).toBeGreaterThanOrEqual(3);
  });

  it('includes items in the response', async () => {
    const { user, location } = await setup();
    const bin = await createTestBin(app, user.token, location.id, {
      name: 'Bin With Items',
      items: ['screwdriver', 'wrench'],
    });

    const shareRes = await createShare(app, user.token, bin.id);
    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);

    expect(res.status).toBe(200);
    const items = typeof res.body.items === 'string' ? JSON.parse(res.body.items) : res.body.items;
    expect(items.length).toBe(2);
    // Items should only have name/quantity, no id
    expect(items[0].id).toBeUndefined();
    expect(items[0].name).toBeDefined();
  });

  it('returns security headers (Referrer-Policy, X-Robots-Tag)', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('returns 404 for expired share', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    // Manually set expires_at to the past
    getDb().prepare("UPDATE bin_shares SET expires_at = datetime('now', '-1 hour') WHERE token = ?").run(shareRes.body.token);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(404);
  });
});

// ── Photo endpoints ─────────────────────────────────────────────────────

describe.each(['file', 'thumb'] as const)('GET /api/shared/:token/photos/:photoId/%s', (variant) => {
  it('returns 404 for invalid share token', async () => {
    const res = await request(app).get(`/api/shared/bad-token/photos/fake-photo/${variant}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent photo', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(app, user.token, bin.id);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}/photos/nonexistent/${variant}`);
    expect(res.status).toBe(404);
  });
});
