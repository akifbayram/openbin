import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/api-keys', () => {
  it('returns empty list initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns created keys', async () => {
    const { token } = await createTestUser(app);

    await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Key' });

    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].name).toBe('Test Key');
    expect(res.body.count).toBe(1);
  });

  it('excludes revoked keys', async () => {
    const { token } = await createTestUser(app);

    const createRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Revoke' });

    await request(app)
      .delete(`/api/api-keys/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/api-keys');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/api-keys', () => {
  it('creates with 201 and correct structure', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Key' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.key).toBeDefined();
    expect(res.body.keyPrefix).toBeDefined();
    expect(res.body.name).toBe('My Key');
  });

  it('key starts with sk_openbin_', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Prefix Test' });

    expect(res.body.key.startsWith('sk_openbin_')).toBe(true);
  });

  it('trims name', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  My Key  ' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Key');
  });

  it('enforces max 10 limit', async () => {
    const { token } = await createTestUser(app);

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Key ${i}` });
    }

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Key 11' });

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/api-keys/:id', () => {
  it('revokes successfully', async () => {
    const { token } = await createTestUser(app);

    const createRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Delete' });

    const res = await request(app)
      .delete(`/api/api-keys/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('API key revoked');
  });

  it('returns 404 for non-existent', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .delete('/api/api-keys/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
