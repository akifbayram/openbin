import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('GET /api/bins/pinned', () => {
  it('returns empty list for new location', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);

    const res = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: loc.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], count: 0 });
  });

  it('returns pinned bin after pinning', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: loc.id });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].id).toBe(bin.id);
  });

  it('returns 422 when location_id is missing', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it('returns 403 for non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const loc = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${otherToken}`)
      .query({ location_id: loc.id });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/bins/:id/pin', () => {
  it('pinning same bin twice is a no-op', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const res1 = await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);

    const list = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: loc.id });
    expect(list.body.count).toBe(1);
  });

  it('enforces 20-pin limit', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);

    const bins = await Promise.all(
      Array.from({ length: 21 }, (_, i) => createTestBin(app, token, loc.id, { name: `Bin ${i}` })),
    );

    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post(`/api/bins/${bins[i].id}/pin`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }

    const res = await request(app)
      .post(`/api/bins/${bins[20].id}/pin`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/20/);
  });
});

describe('PUT /api/bins/pinned/reorder', () => {
  it('updates pin order', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin1 = await createTestBin(app, token, loc.id, { name: 'A' });
    const bin2 = await createTestBin(app, token, loc.id, { name: 'B' });

    await request(app).post(`/api/bins/${bin1.id}/pin`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/bins/${bin2.id}/pin`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put('/api/bins/pinned/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ bin_ids: [bin2.id, bin1.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: loc.id });

    expect(list.body.results[0].id).toBe(bin2.id);
    expect(list.body.results[1].id).toBe(bin1.id);
  });

  it('returns 422 for empty array', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/bins/pinned/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ bin_ids: [] });

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/bins/:id/pin', () => {
  it('removes bin from pinned list', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    await request(app).post(`/api/bins/${bin.id}/pin`).set('Authorization', `Bearer ${token}`);

    const delRes = await request(app)
      .delete(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.pinned).toBe(false);

    const list = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: loc.id });
    expect(list.body.count).toBe(0);
  });
});

describe('auth', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/bins/pinned').query({ location_id: 'fake' });
    expect(res.status).toBe(401);
  });
});
