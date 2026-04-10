import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { AVATAR_STORAGE_PATH } from '../lib/uploadConfig.js';
import { createTestUser, TEST_PNG } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
  fs.mkdirSync(AVATAR_STORAGE_PATH, { recursive: true });
});

afterEach(() => {
  try {
    const files = fs.readdirSync(AVATAR_STORAGE_PATH);
    for (const file of files) {
      fs.unlinkSync(path.join(AVATAR_STORAGE_PATH, file));
    }
  } catch { /* dir may not exist */ }
});

describe('POST /api/auth/avatar', () => {
  it('uploads avatar and returns URL', async () => {
    const { token, user } = await createTestUser(app);

    const res = await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', TEST_PNG, 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe(`/api/auth/avatar/${user.id}`);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/avatar')
      .attach('avatar', TEST_PNG, 'avatar.png');

    expect(res.status).toBe(401);
  });

  it('returns 422 without file', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/avatar/:userId', () => {
  it('serves uploaded avatar', async () => {
    const { token, user } = await createTestUser(app);

    await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', TEST_PNG, 'avatar.png');

    const res = await request(app)
      .get(`/api/auth/avatar/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['cache-control']).toContain('private');
  });

  it('returns 404 when no avatar set', async () => {
    const { token, user } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/auth/avatar/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent user', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/auth/avatar/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/auth/avatar', () => {
  it('removes avatar', async () => {
    const { token, user } = await createTestUser(app);

    await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', TEST_PNG, 'avatar.png');

    const delRes = await request(app)
      .delete('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/auth/avatar/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });

  it('succeeds even when no avatar exists', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .delete('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/auth/avatar');
    expect(res.status).toBe(401);
  });
});
