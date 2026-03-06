import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('POST /api/bins/:id/items', () => {
  it('adds items to a bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Screwdriver', 'Hammer'] });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].name).toBe('Screwdriver');
    expect(res.body.items[1].name).toBe('Hammer');
  });

  it('returns 422 for missing items array', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('adds items with quantity', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ name: 'AA Battery', quantity: 12 }, 'Flashlight'] });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].name).toBe('AA Battery');
    expect(res.body.items[0].quantity).toBe(12);
    expect(res.body.items[1].name).toBe('Flashlight');
    expect(res.body.items[1].quantity).toBeNull();
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/bins/fake-bin-id/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Something'] });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/bins/:id/items/:itemId', () => {
  it('removes a single item', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    // Add items
    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Keep', 'Remove'] });

    const itemToRemove = addRes.body.items[1];

    const res = await request(app)
      .delete(`/api/bins/${bin.id}/items/${itemToRemove.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent item', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .delete(`/api/bins/${bin.id}/items/fake-item-id`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/bins/:id/items/:itemId', () => {
  it('renames an item', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Old Name'] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('updates item quantity', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Widget'] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Widget', quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Widget');
    expect(res.body.quantity).toBe(5);
  });

  it('clears quantity when set to null', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ name: 'Tracked', quantity: 3 }] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tracked', quantity: null });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBeNull();
  });

  it('returns 422 for missing name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Item'] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/bins/:id/items/:itemId/quantity', () => {
  it('updates quantity', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ name: 'Battery', quantity: 5 }] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .patch(`/api/bins/${bin.id}/items/${item.id}/quantity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 10 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
    expect(res.body.quantity).toBe(10);
  });

  it('removes item when quantity is 0', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ name: 'Last One', quantity: 1 }] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .patch(`/api/bins/${bin.id}/items/${item.id}/quantity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
    expect(res.body.removed).toBe(true);
  });

  it('returns 422 for non-numeric quantity', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const addRes = await request(app)
      .post(`/api/bins/${bin.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['Item'] });

    const item = addRes.body.items[0];

    const res = await request(app)
      .patch(`/api/bins/${bin.id}/items/${item.id}/quantity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 'abc' });

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/bins/:id/items/reorder', () => {
  it('reorders items', async () => {
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

  it('returns 422 for missing item_ids', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .put(`/api/bins/${bin.id}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
