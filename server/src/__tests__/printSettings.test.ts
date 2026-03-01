import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/print-settings', () => {
  it('returns null initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/print-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns saved settings', async () => {
    const { token } = await createTestUser(app);

    const settings = { fontSize: 12, orientation: 'landscape' };
    await request(app)
      .put('/api/print-settings')
      .set('Authorization', `Bearer ${token}`)
      .send(settings);

    const res = await request(app)
      .get('/api/print-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
  });
});

describe('PUT /api/print-settings', () => {
  it('creates settings', async () => {
    const { token } = await createTestUser(app);

    const settings = { fontSize: 12 };
    const res = await request(app)
      .put('/api/print-settings')
      .set('Authorization', `Bearer ${token}`)
      .send(settings);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(settings);
  });

  it('upserts on second PUT', async () => {
    const { token } = await createTestUser(app);

    await request(app)
      .put('/api/print-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ fontSize: 12 });

    const res = await request(app)
      .put('/api/print-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ fontSize: 16, margin: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ fontSize: 16, margin: 10 });

    // Verify via GET
    const getRes = await request(app)
      .get('/api/print-settings')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body).toEqual({ fontSize: 16, margin: 10 });
  });

  it('rejects non-object body', async () => {
    const { token } = await createTestUser(app);

    // Array is valid JSON but not a plain object
    const arrayRes = await request(app)
      .put('/api/print-settings')
      .set('Authorization', `Bearer ${token}`)
      .send([1, 2, 3]);

    expect(arrayRes.status).toBe(422);
  });
});
