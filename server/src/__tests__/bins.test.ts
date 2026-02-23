import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation, createTestBin, createTestArea } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('POST /api/bins', () => {
  it('creates a bin with items and tags', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: location.id,
        name: 'Electronics',
        items: ['Cable', 'Adapter'],
        tags: ['tech', 'office'],
        notes: 'Spare parts',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Electronics');
    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(6);
    expect(res.body.tags).toEqual(['tech', 'office']);
    expect(res.body.notes).toBe('Spare parts');
  });

  it('auto-generates unique short code IDs', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bin1 = await createTestBin(app, token, location.id);
    const bin2 = await createTestBin(app, token, location.id);

    expect(bin1.id).not.toBe(bin2.id);
    expect(bin1.id).toHaveLength(6);
    expect(bin2.id).toHaveLength(6);
  });

  it('returns 403 for non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ locationId: location.id, name: 'Sneaky Bin' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for missing name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/bins', () => {
  it('returns empty list', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns bins after creating', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'Bin A' });
    await createTestBin(app, token, location.id, { name: 'Bin B' });

    const res = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('filters by search query', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'Electronics' });
    await createTestBin(app, token, location.id, { name: 'Kitchen Supplies' });

    const res = await request(app)
      .get(`/api/bins?location_id=${location.id}&q=kitchen`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toBe('Kitchen Supplies');
  });

  it('filters by tag', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'Bin A', tags: ['red'] });
    await createTestBin(app, token, location.id, { name: 'Bin B', tags: ['blue'] });

    const res = await request(app)
      .get(`/api/bins?location_id=${location.id}&tag=red`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toBe('Bin A');
  });

  it('sorts by name ascending', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'Zebra' });
    await createTestBin(app, token, location.id, { name: 'Alpha' });

    const res = await request(app)
      .get(`/api/bins?location_id=${location.id}&sort=name&sort_dir=asc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0].name).toBe('Alpha');
    expect(res.body.results[1].name).toBe('Zebra');
  });
});

describe('GET /api/bins/:id', () => {
  it('returns a single bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'My Bin' });

    const res = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('My Bin');
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/non-existent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);
    const bin = await createTestBin(app, ownerToken, location.id);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/bins/:id', () => {
  it('updates bin name, tags, and notes', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated', tags: ['new-tag'], notes: 'Updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.tags).toEqual(['new-tag']);
    expect(res.body.notes).toBe('Updated notes');
  });

  it('replaces items via full replacement', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { items: ['Old Item'] });

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: ['New Item A', 'New Item B'] });

    expect(res.status).toBe(200);

    // Verify items by fetching bin items
    const itemsRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(itemsRes.body.items).toHaveLength(2);
  });
});

describe('DELETE /api/bins/:id (soft delete)', () => {
  it('soft-deletes a bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify gone from list
    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(0);
  });

  it('appears in trash after soft delete', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const trashRes = await request(app)
      .get(`/api/bins/trash?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(trashRes.body.count).toBe(1);
    expect(trashRes.body.results[0].id).toBe(bin.id);
  });
});

describe('POST /api/bins/:id/restore', () => {
  it('restores a soft-deleted bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    // Soft delete then restore
    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify back in list
    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(1);
  });
});

describe('DELETE /api/bins/:id/permanent', () => {
  it('permanently deletes a soft-deleted bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    // Must soft-delete first
    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/bins/${bin.id}/permanent`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify gone from trash too
    const trashRes = await request(app)
      .get(`/api/bins/trash?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(trashRes.body.count).toBe(0);
  });

  it('returns 404 for non-deleted bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .delete(`/api/bins/${bin.id}/permanent`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/bins/lookup/:shortCode', () => {
  it('looks up bin by short code', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Lookup Bin' });

    const res = await request(app)
      .get(`/api/bins/lookup/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lookup Bin');
  });

  it('returns 404 for unknown short code', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/bins/lookup/ZZZZZZ')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/bins/:id/pin and DELETE /api/bins/:id/pin', () => {
  it('pins and unpins a bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    // Pin
    const pinRes = await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);

    expect(pinRes.status).toBe(200);
    expect(pinRes.body.pinned).toBe(true);

    // Verify in pinned list
    const pinnedRes = await request(app)
      .get(`/api/bins/pinned?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(pinnedRes.body.count).toBe(1);

    // Unpin
    const unpinRes = await request(app)
      .delete(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${token}`);

    expect(unpinRes.status).toBe(200);
    expect(unpinRes.body.pinned).toBe(false);
  });
});

describe('POST /api/bins/:id/move', () => {
  it('moves a bin to a different location', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Location 1');
    const loc2 = await createTestLocation(app, token, 'Location 2');
    const bin = await createTestBin(app, token, loc1.id, { name: 'Movable' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);
    expect(res.body.location_id).toBe(loc2.id);

    // Verify gone from loc1
    const list1 = await request(app)
      .get(`/api/bins?location_id=${loc1.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list1.body.count).toBe(0);

    // Verify in loc2
    const list2 = await request(app)
      .get(`/api/bins?location_id=${loc2.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list2.body.count).toBe(1);
  });
});

describe('PUT /api/bins/:id/add-tags', () => {
  it('merges tags without duplicates', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { tags: ['existing'] });

    const res = await request(app)
      .put(`/api/bins/${bin.id}/add-tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['existing', 'new-tag'] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(expect.arrayContaining(['existing', 'new-tag']));
    expect(res.body.tags).toHaveLength(2);
  });
});
