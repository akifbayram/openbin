import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createShare as createShareHelper, createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('bin shares', () => {
  async function setup() {
    const user = await createTestUser(app);
    const location = await createTestLocation(app, user.token);
    const bin = await createTestBin(app, user.token, location.id);
    return { user, location, bin };
  }

  function createShare(token: string, binId: string) {
    return createShareHelper(app, token, binId);
  }

  it('POST create share — returns 201 with token', async () => {
    const { user, bin } = await setup();
    const res = await createShare(user.token, bin.id);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.visibility).toBe('unlisted');
    expect(res.body.viewCount).toBe(0);
  });

  it('POST create share — idempotent (returns 200 with same token)', async () => {
    const { user, bin } = await setup();
    const res1 = await createShare(user.token, bin.id);
    expect(res1.status).toBe(201);

    const res2 = await createShare(user.token, bin.id);
    expect(res2.status).toBe(200);
    expect(res2.body.token).toBe(res1.body.token);
  });

  it('GET shared bin via token — returns bin data without auth', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(user.token, bin.id);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeUndefined();
    expect(res.body.name).toBe(bin.name);
    expect(res.body.shareToken).toBe(shareRes.body.token);
  });

  it('GET shared bin — 404 for invalid token', async () => {
    const res = await request(app).get('/api/shared/invalidtoken123');
    expect(res.status).toBe(404);
  });

  it('DELETE revoke — invalidates token', async () => {
    const { user, bin } = await setup();
    await createShare(user.token, bin.id);

    const res = await request(app)
      .delete(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  it('GET shared bin after revoke — 404', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(user.token, bin.id);

    await request(app)
      .delete(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app).get(`/api/shared/${shareRes.body.token}`);
    expect(res.status).toBe(404);
  });

  it('view count increments on access', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(user.token, bin.id);
    const token = shareRes.body.token;

    await request(app).get(`/api/shared/${token}`);
    await request(app).get(`/api/shared/${token}`);

    const infoRes = await request(app)
      .get(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(infoRes.body.viewCount).toBeGreaterThanOrEqual(2);
  });

  it('POST create share — 422 for private bin', async () => {
    const { user, location } = await setup();
    const bin = await createTestBin(app, user.token, location.id);

    // Set bin to private
    await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ visibility: 'private' });

    const res = await createShare(user.token, bin.id);
    expect(res.status).toBe(422);
  });

  it('POST create share — 401 without auth', async () => {
    const { bin } = await setup();
    const res = await request(app)
      .post(`/api/bins/${bin.id}/share`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('POST create share — 404 for non-existent bin', async () => {
    const { user } = await setup();
    const res = await request(app)
      .post('/api/bins/nonexistent/share')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('GET /api/bins/:id/share — returns share info', async () => {
    const { user, bin } = await setup();
    const shareRes = await createShare(user.token, bin.id);

    const res = await request(app)
      .get(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(shareRes.body.token);
    expect(res.body.visibility).toBe('unlisted');
  });

  it('GET /api/bins/:id/share — 404 when no active share', async () => {
    const { user, bin } = await setup();
    const res = await request(app)
      .get(`/api/bins/${bin.id}/share`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(404);
  });
});
