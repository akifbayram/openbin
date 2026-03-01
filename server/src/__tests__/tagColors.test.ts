import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/tag-colors', () => {
  it('returns empty initially', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns created tag colors', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    const res = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].tag).toBe('tools');
    expect(res.body.results[0].color).toBe('blue');
    expect(res.body.count).toBe(1);
  });

  it('requires membership', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('requires location_id', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/tag-colors', () => {
  it('creates tag color', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    expect(res.status).toBe(200);
    expect(res.body.tag).toBe('tools');
    expect(res.body.color).toBe('blue');
  });

  it('upserts on conflict', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    const res = await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'red' });

    expect(res.status).toBe(200);
    expect(res.body.tag).toBe('tools');
    expect(res.body.color).toBe('red');

    // Verify only one tag color exists
    const listRes = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.results).toHaveLength(1);
  });

  it('deletes when color is empty', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    const res = await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });

    // Verify removed
    const listRes = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.results).toEqual([]);
  });

  it('requires membership', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tag-colors/:tag', () => {
  it('deletes tag color', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: 'blue' });

    const res = await request(app)
      .delete(`/api/tag-colors/tools?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });

    // Verify removed
    const listRes = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.results).toEqual([]);
  });

  it('idempotent delete of non-existent tag', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .delete(`/api/tag-colors/nonexistent?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });
});
