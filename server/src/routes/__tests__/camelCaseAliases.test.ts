/**
 * Verifies that mixed snake_case → camelCase route aliases accept both forms.
 *
 * Six routes were updated to also accept camelCase request fields/query params
 * for consistency with newer routes and the public TS types in src/types.ts.
 * Each test asserts that submitting both forms returns equivalent successful
 * responses and that the legacy snake_case form is still honored.
 */
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestBin, createTestLocation, createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/bins/trash — accepts both locationId and location_id', () => {
  it('returns identical responses for camelCase and snake_case', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const camelRes = await request(app)
      .get('/api/bins/trash')
      .set('Authorization', `Bearer ${token}`)
      .query({ locationId: location.id });

    const snakeRes = await request(app)
      .get('/api/bins/trash')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: location.id });

    expect(camelRes.status).toBe(200);
    expect(snakeRes.status).toBe(200);
    expect(camelRes.body).toEqual(snakeRes.body);
  });

  it('returns 422 when neither alias is provided', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/trash')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/locationId/);
  });
});

describe('GET /api/bins/pinned — accepts both locationId and location_id', () => {
  it('returns identical responses for camelCase and snake_case', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);

    const camelRes = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ locationId: location.id });

    const snakeRes = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: location.id });

    expect(camelRes.status).toBe(200);
    expect(snakeRes.status).toBe(200);
    expect(camelRes.body.count).toBe(1);
    expect(camelRes.body).toEqual(snakeRes.body);
  });

  it('returns 422 when neither alias is provided', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/locationId/);
  });
});

describe('PUT /api/bins/pinned/reorder — accepts both binIds and bin_ids', () => {
  it('reorders pinned bins via camelCase binIds', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin1 = await createTestBin(app, token, location.id, { name: 'A' });
    const bin2 = await createTestBin(app, token, location.id, { name: 'B' });

    await request(app).post(`/api/bins/${bin1.id}/pin`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/bins/${bin2.id}/pin`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put('/api/bins/pinned/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ binIds: [bin2.id, bin1.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app)
      .get('/api/bins/pinned')
      .set('Authorization', `Bearer ${token}`)
      .query({ locationId: location.id });
    expect(list.body.results[0].id).toBe(bin2.id);
    expect(list.body.results[1].id).toBe(bin1.id);
  });

  it('reorders pinned bins via snake_case bin_ids (legacy)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin1 = await createTestBin(app, token, location.id, { name: 'A' });
    const bin2 = await createTestBin(app, token, location.id, { name: 'B' });

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
      .query({ locationId: location.id });
    expect(list.body.results[0].id).toBe(bin2.id);
    expect(list.body.results[1].id).toBe(bin1.id);
  });

  it('returns 422 when neither alias is provided', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/bins/pinned/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/binIds/);
  });
});

describe('GET /api/tag-colors — accepts both locationId and location_id', () => {
  it('returns identical responses for camelCase and snake_case', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await request(app)
      .put('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, tag: 'tools', color: '#0000FF' });

    const camelRes = await request(app)
      .get('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .query({ locationId: location.id });

    const snakeRes = await request(app)
      .get('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: location.id });

    expect(camelRes.status).toBe(200);
    expect(snakeRes.status).toBe(200);
    expect(camelRes.body.count).toBe(1);
    expect(camelRes.body).toEqual(snakeRes.body);
  });

  it('returns 422 when neither alias is provided', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/tag-colors')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/locationId/);
  });
});

describe('PUT /api/bins/:id/items/reorder — accepts both itemIds and item_ids', () => {
  it('reorders items via camelCase itemIds', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['First', 'Second', 'Third'] });

    const ids = addRes.body.items.map((i: { id: string }) => i.id);
    const reversed = [...ids].reverse();

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('reorders items via snake_case item_ids (legacy)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['First', 'Second', 'Third'] });

    const ids = addRes.body.items.map((i: { id: string }) => i.id);
    const reversed = [...ids].reverse();

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item_ids: reversed });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 when neither alias is provided', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/itemIds/);
  });
});

describe('POST /api/saved-views — accepts both searchQuery and search_query', () => {
  it('persists searchQuery sent in camelCase', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Camel View', searchQuery: 'camel-term', sort: 'name' });

    expect(res.status).toBe(201);
    // Response field name remains snake_case (unchanged response contract).
    expect(res.body.search_query).toBe('camel-term');
    expect(res.body.name).toBe('Camel View');
  });

  it('persists search_query sent in snake_case (legacy)', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Snake View', search_query: 'snake-term', sort: 'name' });

    expect(res.status).toBe(201);
    expect(res.body.search_query).toBe('snake-term');
    expect(res.body.name).toBe('Snake View');
  });

  it('produces identical persisted state for both forms', async () => {
    const { token: tokenA } = await createTestUser(app);
    const { token: tokenB } = await createTestUser(app);

    const camelRes = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'View', searchQuery: 'q', sort: 'updated', filters: { tags: ['x'] } });

    const snakeRes = await request(app)
      .post('/api/saved-views')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'View', search_query: 'q', sort: 'updated', filters: { tags: ['x'] } });

    expect(camelRes.status).toBe(201);
    expect(snakeRes.status).toBe(201);

    // Ignore id/created_at/user; everything else must match.
    const stripVolatile = (b: Record<string, unknown>) => {
      const { id: _id, created_at: _ca, ...rest } = b;
      return rest;
    };
    expect(stripVolatile(camelRes.body)).toEqual(stripVolatile(snakeRes.body));
  });
});
