import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestArea, createTestBin, createTestLocation, createTestUser } from './helpers.js';

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
    expect(res.body.id).toHaveLength(36); // UUID
    expect(res.body.short_code).toHaveLength(6);
    expect(res.body.tags).toEqual(['tech', 'office']);
    expect(res.body.notes).toBe('Spare parts');
  });

  it('auto-generates unique short code IDs', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bin1 = await createTestBin(app, token, location.id);
    const bin2 = await createTestBin(app, token, location.id);

    expect(bin1.id).not.toBe(bin2.id);
    expect(bin1.id).toHaveLength(36); // UUID
    expect(bin1.short_code).toHaveLength(6);
    expect(bin2.short_code).toHaveLength(6);
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

  it('returns 403 for viewer creating a bin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id]
    );
    const res = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ locationId: location.id, name: 'Viewer Bin' });
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

  it('returns 403 for non-member', async () => {
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

describe('PUT /api/bins/:id — role permissions', () => {
  it('returns 403 for viewer editing a bin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id]
    );
    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ items: ['test item'] });
    expect(res.status).toBe(403);
  });

  it('member can edit items on any bin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ items: ['added by member'] });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'added by member' })]));
  });

  it('member cannot edit metadata on bin they did not create', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'renamed by member' });
    expect(res.status).toBe(403);
  });

  it('member can edit metadata on bin they created', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    const bin = await createTestBin(app, memberToken, location.id);
    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'renamed by creator' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('renamed by creator');
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
      .get(`/api/bins/lookup/${bin.short_code}`)
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

  it('returns 403 for viewer pinning a bin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id]
    );
    const res = await request(app)
      .post(`/api/bins/${bin.id}/pin`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
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

describe('POST /api/bins/:id/duplicate', () => {
  it('duplicates a bin copying all properties with a new short code', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const area = await createTestArea(app, token, location.id, 'Garage');
    const original = await createTestBin(app, token, location.id, {
      name: 'Electronics',
      items: ['Cable', 'Adapter'],
      tags: ['tech', 'office'],
      notes: 'Spare parts',
    });

    // Assign area, icon, color, card_style via update
    await request(app)
      .put(`/api/bins/${original.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ areaId: area.id, icon: 'box', color: '#ff0000', cardStyle: '{"variant":"border"}' });

    const res = await request(app)
      .post(`/api/bins/${original.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(36); // UUID
    expect(res.body.short_code).toHaveLength(6);
    expect(res.body.id).not.toBe(original.id);
    expect(res.body.name).toBe('Copy of Electronics');
    expect(res.body.location_id).toBe(location.id);
    expect(res.body.area_id).toBe(area.id);
    expect(res.body.tags).toEqual(['tech', 'office']);
    expect(res.body.notes).toBe('Spare parts');
    expect(res.body.icon).toBe('box');
    expect(res.body.color).toBe('#ff0000');
    expect(res.body.card_style).toBe('{"variant":"border"}');

    // Verify items were copied
    const detail = await request(app)
      .get(`/api/bins/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.items).toHaveLength(2);
    expect(detail.body.items.map((i: { name: string }) => i.name)).toEqual(['Cable', 'Adapter']);
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/bins/ZZZZZZ/duplicate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for bin in location user is not a member of', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);
    const bin = await createTestBin(app, ownerToken, location.id);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('allows custom name override', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Original' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Custom Name' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Custom Name');
  });

  it('logs a duplicate activity entry', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'LogTest' });

    await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    const activityRes = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${token}`);

    const duplicateEntry = activityRes.body.results.find(
      (e: { action: string; entity_type: string }) => e.action === 'duplicate' && e.entity_type === 'bin',
    );
    expect(duplicateEntry).toBeDefined();
    expect(duplicateEntry.entity_name).toBe('Copy of LogTest');
  });

  it('sets created_by to the duplicating user, not the original creator', async () => {
    const { token: ownerToken, user: owner } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);
    const bin = await createTestBin(app, ownerToken, location.id, { name: 'Owned' });

    // Invite a second user to the location
    const { token: memberToken, user: member } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(201);
    expect(res.body.created_by).toBe(member.id);
    expect(res.body.created_by).not.toBe(owner.id);
  });

  it('returns 404 when duplicating a soft-deleted bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid custom name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x'.repeat(256) });

    expect(res.status).toBe(422);
  });

  it('duplicates a bin with no items', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Empty Bin' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Copy of Empty Bin');
    expect(res.body.items).toEqual([]);
  });
});

describe('POST /api/bins/:id/move — custom fields', () => {
  async function setupCustomField(locationId: string, name: string, position: number) {
    const { generateUuid, query: dbQuery } = await import('../db.js');
    const id = generateUuid();
    await dbQuery(
      'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
      [id, locationId, name, position],
    );
    return id;
  }

  async function setFieldValue(binId: string, fieldId: string, value: string) {
    const { generateUuid, query: dbQuery } = await import('../db.js');
    await dbQuery(
      'INSERT INTO bin_custom_field_values (id, bin_id, field_id, value) VALUES ($1, $2, $3, $4)',
      [generateUuid(), binId, fieldId, value],
    );
  }

  async function getFieldValues(binId: string) {
    const { query: dbQuery } = await import('../db.js');
    const result = await dbQuery<{ field_id: string; value: string }>(
      'SELECT field_id, value FROM bin_custom_field_values WHERE bin_id = $1',
      [binId],
    );
    return result.rows;
  }

  async function getLocationFields(locationId: string) {
    const { query: dbQuery } = await import('../db.js');
    const result = await dbQuery<{ id: string; name: string; position: number }>(
      'SELECT id, name, position FROM location_custom_fields WHERE location_id = $1 ORDER BY position',
      [locationId],
    );
    return result.rows;
  }

  it('remaps custom field values to matching target fields', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Source');
    const loc2 = await createTestLocation(app, token, 'Target');
    const bin = await createTestBin(app, token, loc1.id);

    const srcFieldA = await setupCustomField(loc1.id, 'Color', 0);
    const srcFieldB = await setupCustomField(loc1.id, 'Size', 1);
    const tgtFieldA = await setupCustomField(loc2.id, 'Color', 0);
    const tgtFieldB = await setupCustomField(loc2.id, 'Size', 1);

    await setFieldValue(bin.id, srcFieldA, 'Red');
    await setFieldValue(bin.id, srcFieldB, 'Large');

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);

    const values = await getFieldValues(bin.id);
    expect(values).toHaveLength(2);
    const valueMap = new Map(values.map(v => [v.field_id, v.value]));
    expect(valueMap.get(tgtFieldA)).toBe('Red');
    expect(valueMap.get(tgtFieldB)).toBe('Large');
  });

  it('auto-creates missing fields in target location', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Source');
    const loc2 = await createTestLocation(app, token, 'Target');
    const bin = await createTestBin(app, token, loc1.id);

    const srcFieldA = await setupCustomField(loc1.id, 'Color', 0);
    const srcFieldB = await setupCustomField(loc1.id, 'Weight', 1);
    // Target only has 'Color', not 'Weight'
    const tgtFieldA = await setupCustomField(loc2.id, 'Color', 0);

    await setFieldValue(bin.id, srcFieldA, 'Blue');
    await setFieldValue(bin.id, srcFieldB, '5kg');

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);

    // 'Weight' should have been auto-created in target
    const targetFields = await getLocationFields(loc2.id);
    expect(targetFields).toHaveLength(2);
    const weightField = targetFields.find(f => f.name === 'Weight');
    expect(weightField).toBeDefined();
    expect(weightField!.position).toBe(1); // appended after position 0

    const values = await getFieldValues(bin.id);
    expect(values).toHaveLength(2);
    const valueMap = new Map(values.map(v => [v.field_id, v.value]));
    expect(valueMap.get(tgtFieldA)).toBe('Blue');
    expect(valueMap.get(weightField!.id)).toBe('5kg');

    // Response body custom_fields should use target field IDs
    expect(res.body.custom_fields[tgtFieldA]).toBe('Blue');
    expect(res.body.custom_fields[weightField!.id]).toBe('5kg');
  });

  it('auto-creates all fields when target has none (demo seed scenario)', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Home');
    const loc2 = await createTestLocation(app, token, 'Storage');
    const bin = await createTestBin(app, token, loc1.id, { name: 'Board Games' });

    // Source has 4 fields (like demo seed), target has none
    const _f1 = await setupCustomField(loc1.id, 'Purchase Date', 0);
    const _f2 = await setupCustomField(loc1.id, 'Estimated Value', 1);
    const f3 = await setupCustomField(loc1.id, 'Condition', 2);
    const f4 = await setupCustomField(loc1.id, 'Last Checked', 3);

    // Bin only has 2 of the 4 fields populated (like demo seed Board Games)
    await setFieldValue(bin.id, f3, 'Well-loved');
    await setFieldValue(bin.id, f4, '2026-02-15');

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);

    // Target should have exactly 2 auto-created fields (only populated ones)
    const targetFields = await getLocationFields(loc2.id);
    expect(targetFields).toHaveLength(2);
    expect(targetFields.map(f => f.name).sort()).toEqual(['Condition', 'Last Checked']);

    // Bin response should have custom_fields with target field IDs
    const condField = targetFields.find(f => f.name === 'Condition')!;
    const lcField = targetFields.find(f => f.name === 'Last Checked')!;
    expect(res.body.custom_fields[condField.id]).toBe('Well-loved');
    expect(res.body.custom_fields[lcField.id]).toBe('2026-02-15');

    // Verify via GET too
    const getRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.custom_fields[condField.id]).toBe('Well-loved');
    expect(getRes.body.custom_fields[lcField.id]).toBe('2026-02-15');
  });

  it('moves bin without custom fields unchanged', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Source');
    const loc2 = await createTestLocation(app, token, 'Target');
    const bin = await createTestBin(app, token, loc1.id, { name: 'Plain' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);
    expect(res.body.location_id).toBe(loc2.id);

    const values = await getFieldValues(bin.id);
    expect(values).toHaveLength(0);
  });

  it('preserves custom fields for bulk-moved bins', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token, 'Source');
    const loc2 = await createTestLocation(app, token, 'Target');
    const bin1 = await createTestBin(app, token, loc1.id, { name: 'Bin1' });
    const bin2 = await createTestBin(app, token, loc1.id, { name: 'Bin2' });

    const srcField = await setupCustomField(loc1.id, 'Material', 0);
    await setFieldValue(bin1.id, srcField, 'Wood');
    await setFieldValue(bin2.id, srcField, 'Metal');

    // Move both bins individually (no bulk route exists)
    const res1 = await request(app)
      .post(`/api/bins/${bin1.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });
    const res2 = await request(app)
      .post(`/api/bins/${bin2.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: loc2.id });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // 'Material' should exist once in target
    const targetFields = await getLocationFields(loc2.id);
    const materialFields = targetFields.filter(f => f.name === 'Material');
    expect(materialFields).toHaveLength(1);

    // Both bins should reference the same target field
    const vals1 = await getFieldValues(bin1.id);
    const vals2 = await getFieldValues(bin2.id);
    expect(vals1).toHaveLength(1);
    expect(vals2).toHaveLength(1);
    expect(vals1[0].field_id).toBe(vals2[0].field_id);
    expect(vals1[0].value).toBe('Wood');
    expect(vals2[0].value).toBe('Metal');
  });

  it('non-admin member move does not create custom fields in target', async () => {
    // Admin creates source location with custom fields and a bin
    const { token: adminToken } = await createTestUser(app);
    const loc1 = await createTestLocation(app, adminToken, 'Source');
    const bin = await createTestBin(app, adminToken, loc1.id, { name: 'FieldBin' });

    const srcColor = await setupCustomField(loc1.id, 'Color', 0);
    const srcWeight = await setupCustomField(loc1.id, 'Weight', 1);
    await setFieldValue(bin.id, srcColor, 'Red');
    await setFieldValue(bin.id, srcWeight, '5kg');

    // Second user creates target location (is admin there) and sets up one matching field
    const { token: memberToken, user: memberUser } = await createTestUser(app);
    const loc2 = await createTestLocation(app, memberToken, 'Target');
    const tgtColor = await setupCustomField(loc2.id, 'Color', 0);

    // Make the second user a member (not admin) of source location so they can be added as admin there,
    // but actually: the move endpoint requires admin on SOURCE. So make them admin on source, member on target.
    // Re-read the route: requireAdmin(access.locationId) = admin on SOURCE.
    // We need admin on source, non-admin on target.
    // Invite memberUser to source as admin
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: loc1.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'admin' WHERE location_id = $1 AND user_id = $2",
      [loc1.id, memberUser.id],
    );
    // Demote memberUser to 'member' on target (they created it so they're admin)
    await dbQuery(
      "UPDATE location_members SET role = 'member' WHERE location_id = $1 AND user_id = $2",
      [loc2.id, memberUser.id],
    );

    const res = await request(app)
      .post(`/api/bins/${bin.id}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ locationId: loc2.id });

    expect(res.status).toBe(200);
    expect(res.body.location_id).toBe(loc2.id);

    // Target should still have only the original 'Color' field — 'Weight' must NOT be auto-created
    const targetFields = await getLocationFields(loc2.id);
    expect(targetFields).toHaveLength(1);
    expect(targetFields[0].name).toBe('Color');

    // Only the matching 'Color' value should be preserved, 'Weight' value should be dropped
    const values = await getFieldValues(bin.id);
    expect(values).toHaveLength(1);
    expect(values[0].field_id).toBe(tgtColor);
    expect(values[0].value).toBe('Red');
  });
});

describe('POST /api/bins/:id/photos — viewer restriction', () => {
  it('returns 403 for viewer uploading a photo', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id]
    );
    const res = await request(app)
      .post(`/api/bins/${bin.id}/photos`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/bins/:id — visibility changes', () => {
  it('changes visibility from location to private', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ visibility: 'private' });

    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('private');

    const getRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.visibility).toBe('private');
  });

  it('changes visibility from private to location', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ visibility: 'private' });

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ visibility: 'location' });

    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('location');
  });

  it('viewer cannot change visibility', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    const { query: dbQuery } = await import('../db.js');
    await dbQuery(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id],
    );

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ visibility: 'private' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/bins/:id — custom fields', () => {
  async function setupCustomField(locationId: string, name: string, position: number) {
    const { generateUuid, query: dbQuery } = await import('../db.js');
    const id = generateUuid();
    await dbQuery(
      'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
      [id, locationId, name, position],
    );
    return id;
  }

  it('sets custom field values via PUT', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const fieldId = await setupCustomField(location.id, 'Color', 0);

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customFields: { [fieldId]: 'Red' } });

    expect(res.status).toBe(200);
    expect(res.body.custom_fields[fieldId]).toBe('Red');
  });

  it('replaces existing custom field values', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const fieldA = await setupCustomField(location.id, 'Color', 0);
    const fieldB = await setupCustomField(location.id, 'Size', 1);

    await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customFields: { [fieldA]: 'Red', [fieldB]: 'Large' } });

    const res = await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customFields: { [fieldA]: 'Blue' } });

    expect(res.status).toBe(200);
    expect(res.body.custom_fields[fieldA]).toBe('Blue');
    expect(res.body.custom_fields[fieldB]).toBeUndefined();
  });

  it('GET bin returns custom_fields after PUT', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const fieldId = await setupCustomField(location.id, 'Material', 0);

    await request(app)
      .put(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customFields: { [fieldId]: 'Wood' } });

    const getRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.custom_fields[fieldId]).toBe('Wood');
  });
});
