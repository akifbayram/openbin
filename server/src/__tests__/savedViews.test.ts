import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/saved-views', () => {
  it('returns empty list initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/saved-views')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns created views', async () => {
    const { token } = await createTestUser(app);

    await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My View', search_query: 'test', sort: 'name', filters: { tags: ['a'] } });

    const res = await request(app)
      .get('/api/saved-views')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].name).toBe('My View');
    expect(res.body.count).toBe(1);
  });
});

describe('POST /api/saved-views', () => {
  it('creates with 201', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My View', search_query: 'test', sort: 'name', filters: { tags: ['a'] } });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('My View');
    expect(res.body.search_query).toBe('test');
    expect(res.body.sort).toBe('name');
    expect(res.body.filters).toEqual({ tags: ['a'] });
    expect(res.body.created_at).toBeDefined();
  });

  it('requires name', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('enforces max 10 limit', async () => {
    const { token } = await createTestUser(app);

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/saved-views')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `View ${i}` });
    }

    const res = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'View 11' });

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/saved-views/:id', () => {
  it('updates name', async () => {
    const { token } = await createTestUser(app);

    const createRes = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original' });

    const res = await request(app)
      .put(`/api/saved-views/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('returns 404 for non-existent', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/saved-views/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/saved-views/:id', () => {
  it('deletes with 204', async () => {
    const { token } = await createTestUser(app);

    const createRes = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Delete' });

    const res = await request(app)
      .delete(`/api/saved-views/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .delete('/api/saved-views/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('view gone after delete', async () => {
    const { token } = await createTestUser(app);

    const createRes = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ephemeral' });

    await request(app)
      .delete(`/api/saved-views/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const listRes = await request(app)
      .get('/api/saved-views')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.results).toEqual([]);
    expect(listRes.body.count).toBe(0);
  });
});
