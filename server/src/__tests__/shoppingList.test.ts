import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('POST /api/bins/:binId/shopping-list', () => {
  it('bulk-adds entries from a bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Peanut butter', 'Milk', 'Eggs'] });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(3);
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.entries[0].origin_bin_id).toBe(bin.id);
    expect(res.body.entries.map((e: { name: string }) => e.name).sort()).toEqual(
      ['Eggs', 'Milk', 'Peanut butter'],
    );
  });

  it('allows duplicate names in one call', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk', 'Milk'] });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
  });

  it('rejects empty names array', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: [] });

    expect(res.status).toBe(422);
  });

  it('rejects too many names (> 50)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const names = Array.from({ length: 51 }, (_, i) => `Item ${i}`);
    const res = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names });

    expect(res.status).toBe(422);
  });

  it('returns 404 when bin does not exist', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins/nonexistent/shopping-list')
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk'] });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/locations/:locationId/shopping-list', () => {
  it('returns entries for the location in newest-first order', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Pantry' });

    await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['First'] });
    await new Promise((r) => setTimeout(r, 10));
    await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Second'] });

    const res = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.results[0].name).toBe('Second');
    expect(res.body.results[1].name).toBe('First');
    expect(res.body.results[0].origin_bin_id).toBe(bin.id);
    expect(res.body.results[0].origin_bin_name).toBe('Pantry');
    expect(res.body.results[0].origin_bin_trashed).toBe(false);
  });

  it('returns origin_bin_trashed: true when the bin is in trash', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk'] });

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0].origin_bin_trashed).toBe(true);
    expect(res.body.results[0].origin_bin_id).toBe(bin.id);
  });

  it('excludes entries from private bins for non-creator members', async () => {
    const { token: creatorToken, user: creator } = await createTestUser(app);
    const location = await createTestLocation(app, creatorToken);
    const privateBin = await createTestBin(app, creatorToken, location.id, { name: 'Secret' });
    await request(app)
      .put(`/api/bins/${privateBin.id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ visibility: 'private' });
    await request(app)
      .post(`/api/bins/${privateBin.id}/shopping-list`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ names: ['Secret item'] });

    const { token: otherToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);

    const resCreator = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(resCreator.body.count).toBe(1);
    expect(resCreator.body.results[0].created_by).toBe(creator.id);
  });

  it('rejects non-member access with 403', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: strangerToken } = await createTestUser(app);
    const res = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/shopping-list/:id', () => {
  it('removes an entry', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk'] });
    const entryId = createRes.body.entries[0].id;

    const res = await request(app)
      .delete(`/api/shopping-list/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const listRes = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(0);
  });

  it('returns 404 for nonexistent entry', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .delete('/api/shopping-list/nonexistent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejects non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);
    const bin = await createTestBin(app, ownerToken, location.id);
    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ names: ['Milk'] });
    const entryId = createRes.body.entries[0].id;

    const { token: strangerToken } = await createTestUser(app);
    const res = await request(app)
      .delete(`/api/shopping-list/${entryId}`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects viewer role with 403', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, location.id);
    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ names: ['Milk'] });
    const entryId = createRes.body.entries[0].id;

    const { token: viewerToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });

    // Downgrade to viewer (same pattern as itemCheckouts.test.ts line 62-77)
    const { query } = await import('../db.js');
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    await query(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id != $2",
      [location.id, meRes.body.id],
    );

    const res = await request(app)
      .delete(`/api/shopping-list/${entryId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/locations/:locationId/shopping-list', () => {
  it('adds a manual entry with no origin bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bread' });

    expect(res.status).toBe(201);
    expect(res.body.entry.name).toBe('Bread');
    expect(res.body.entry.origin_bin_id).toBeNull();
    expect(res.body.entry.origin_bin_trashed).toBe(false);
  });

  it('adds a manual entry with an origin bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bread', originBinId: bin.id });

    expect(res.status).toBe(201);
    expect(res.body.entry.origin_bin_id).toBe(bin.id);
  });

  it('rejects missing name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('rejects originBinId that is not in this location', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);
    const otherLocation = await createTestLocation(app, otherToken);
    const otherBin = await createTestBin(app, otherToken, otherLocation.id);

    const res = await request(app)
      .post(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bread', originBinId: otherBin.id });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/shopping-list/:id/purchase', () => {
  it('deletes the entry and adds the name back to the origin bin', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Peanut butter'] });
    const entryId = createRes.body.entries[0].id;

    const res = await request(app)
      .post(`/api/shopping-list/${entryId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.restored).not.toBeNull();
    expect(res.body.restored.binId).toBe(bin.id);
    expect(res.body.restored.name).toBe('Peanut butter');

    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.body.items.map((i: { name: string }) => i.name)).toContain('Peanut butter');

    const listRes = await request(app)
      .get(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(0);
  });

  it('returns restored: null when origin bin is trashed', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk'] });
    const entryId = createRes.body.entries[0].id;

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/shopping-list/${entryId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.restored).toBeNull();
  });

  it('returns restored: null when origin_bin_id is NULL', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const createRes = await request(app)
      .post(`/api/locations/${location.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bread' });
    const entryId = createRes.body.entry.id;

    const res = await request(app)
      .post(`/api/shopping-list/${entryId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.restored).toBeNull();
  });

  it('returns 404 for a nonexistent entry', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/shopping-list/nonexistent/purchase')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 on second purchase (entry already gone)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const createRes = await request(app)
      .post(`/api/bins/${bin.id}/shopping-list`)
      .set('Authorization', `Bearer ${token}`)
      .send({ names: ['Milk'] });
    const entryId = createRes.body.entries[0].id;

    await request(app).post(`/api/shopping-list/${entryId}/purchase`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/shopping-list/${entryId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
