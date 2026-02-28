import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/user-preferences', () => {
  it('returns null initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns saved preferences', async () => {
    const { token } = await createTestUser(app);

    const prefs = { theme: 'dark', language: 'en' };
    await request(app)
      .put('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(prefs);

    const res = await request(app)
      .get('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(prefs);
  });
});

describe('PUT /api/user-preferences', () => {
  it('creates preferences', async () => {
    const { token } = await createTestUser(app);

    const prefs = { dashboardLayout: 'grid' };
    const res = await request(app)
      .put('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(prefs);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(prefs);
  });

  it('upserts on second PUT', async () => {
    const { token } = await createTestUser(app);

    await request(app)
      .put('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark' });

    const res = await request(app)
      .put('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'light', sidebar: 'collapsed' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ theme: 'light', sidebar: 'collapsed' });

    // Verify via GET
    const getRes = await request(app)
      .get('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body).toEqual({ theme: 'light', sidebar: 'collapsed' });
  });

  it('rejects non-object body', async () => {
    const { token } = await createTestUser(app);

    // Array is valid JSON but not a plain object
    const arrayRes = await request(app)
      .put('/api/user-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send([1, 2, 3]);

    expect(arrayRes.status).toBe(422);
  });
});
