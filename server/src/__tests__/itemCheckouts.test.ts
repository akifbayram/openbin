import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

async function joinLocation(app: Express, token: string, inviteCode: string) {
  await request(app)
    .post('/api/locations/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ inviteCode });
}

describe('POST /api/bins/:id/items/:itemId/checkout', () => {
  it('creates a checkout record', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['Widget A'] });

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = itemsRes.body.items[0].id;

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.checkout.item_id).toBe(itemId);
    expect(res.body.checkout.origin_bin_id).toBe(bin.id);
    expect(res.body.checkout.returned_at).toBeNull();
  });

  it('returns 409 if item already checked out', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['Widget A'] });

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = itemsRes.body.items[0].id;

    await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('returns 403 for viewer role', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id, { items: ['Widget A'] });

    const { token: viewerToken } = await createTestUser(app);
    await joinLocation(app, viewerToken, location.invite_code);

    // Downgrade to viewer
    const { query } = await import('../db.js');
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    await query(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id != $2",
      [location.id, meRes.body.id]
    );

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    const itemId = itemsRes.body.items[0].id;

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/bins/:id/items/:itemId/return', () => {
  it('returns item to origin bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['Widget A'] });

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = itemsRes.body.items[0].id;

    await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/return`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.checkout.returned_at).toBeTruthy();
    expect(res.body.checkout.return_bin_id).toBe(bin.id);
  });

  it('moves item when returned to different bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const binA = await createTestBin(app, token, location.id, { name: 'Bin A', items: ['Widget'] });
    const binB = await createTestBin(app, token, location.id, { name: 'Bin B' });

    const itemsRes = await request(app)
      .get(`/api/bins/${binA.id}`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = itemsRes.body.items[0].id;

    await request(app)
      .post(`/api/bins/${binA.id}/items/${itemId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bins/${binA.id}/items/${itemId}/return`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetBinId: binB.id });

    expect(res.status).toBe(200);
    expect(res.body.checkout.return_bin_id).toBe(binB.id);

    // Verify item moved to bin B
    const binBRes = await request(app)
      .get(`/api/bins/${binB.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binBRes.body.items.some((i: { id: string }) => i.id === itemId)).toBe(true);
  });

  it('returns 404 if item not checked out', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['Widget A'] });

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = itemsRes.body.items[0].id;

    const res = await request(app)
      .post(`/api/bins/${bin.id}/items/${itemId}/return`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/bins/:id/checkouts', () => {
  it('returns only active checkouts for the bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['A', 'B'] });

    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    const [itemA, itemB] = itemsRes.body.items;

    await request(app).post(`/api/bins/${bin.id}/items/${itemA.id}/checkout`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/bins/${bin.id}/items/${itemB.id}/checkout`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/bins/${bin.id}/items/${itemA.id}/return`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/bins/${bin.id}/checkouts`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].item_id).toBe(itemB.id);
    expect(res.body.count).toBe(1);
  });
});

describe('GET /api/locations/:locationId/checkouts', () => {
  it('returns checkouts across all bins with context', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const binA = await createTestBin(app, token, location.id, { name: 'Bin A', items: ['Widget'] });
    const binB = await createTestBin(app, token, location.id, { name: 'Bin B', items: ['Gadget'] });

    const binAItems = await request(app).get(`/api/bins/${binA.id}`).set('Authorization', `Bearer ${token}`);
    const binBItems = await request(app).get(`/api/bins/${binB.id}`).set('Authorization', `Bearer ${token}`);

    await request(app).post(`/api/bins/${binA.id}/items/${binAItems.body.items[0].id}/checkout`).set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/bins/${binB.id}/items/${binBItems.body.items[0].id}/checkout`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/locations/${location.id}/checkouts`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toHaveProperty('item_name');
    expect(res.body.results[0]).toHaveProperty('origin_bin_name');
    expect(res.body.results[0]).toHaveProperty('checked_out_by_name');
    expect(res.body.count).toBe(2);
  });
});
