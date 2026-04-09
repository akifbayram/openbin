import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestArea, createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
let token: string;
let locationId: string;

beforeEach(async () => {
  app = createApp();
  const user = await createTestUser(app);
  token = user.token;
  const loc = await createTestLocation(app, token);
  locationId = loc.id;
});

const batch = (body: Record<string, unknown>, authToken?: string) =>
  request(app)
    .post('/api/batch')
    .set('Authorization', `Bearer ${authToken ?? token}`)
    .send(body);

describe('POST /api/batch', () => {
  // --- Validation ---

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/batch').send({ locationId, operations: [{ type: 'create_bin', name: 'x' }] });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing locationId', async () => {
    const res = await batch({ operations: [{ type: 'create_bin', name: 'x' }] });
    expect(res.status).toBe(400);
  });

  it('returns 422 for empty operations array', async () => {
    const res = await batch({ locationId, operations: [] });
    expect(res.status).toBe(422);
  });

  it('returns 422 for operations exceeding max 50', async () => {
    const ops = Array.from({ length: 51 }, (_, i) => ({ type: 'create_bin', name: `bin${i}` }));
    const res = await batch({ locationId, operations: ops });
    expect(res.status).toBe(422);
  });

  it('returns 422 for unknown operation type', async () => {
    const res = await batch({ locationId, operations: [{ type: 'fly_to_moon' }] });
    expect(res.status).toBe(422);
  });

  it('returns 422 for create_bin without name', async () => {
    const res = await batch({ locationId, operations: [{ type: 'create_bin' }] });
    expect(res.status).toBe(422);
  });

  it('returns 422 for add_items without bin_id', async () => {
    const res = await batch({ locationId, operations: [{ type: 'add_items', items: ['a'] }] });
    expect(res.status).toBe(422);
  });

  it('returns 422 for add_items without items array', async () => {
    const res = await batch({ locationId, operations: [{ type: 'add_items', bin_id: 'x' }] });
    expect(res.status).toBe(422);
  });

  it('returns 403 for non-member of location', async () => {
    const other = await createTestUser(app);
    const res = await batch({ locationId, operations: [{ type: 'create_bin', name: 'x' }] }, other.token);
    expect(res.status).toBe(403);
  });

  // --- Success paths ---

  it('create_bin creates a new bin', async () => {
    const res = await batch({ locationId, operations: [{ type: 'create_bin', name: 'My Bin' }] });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[0].bin_id).toBeTruthy();

    // Verify the bin actually exists
    const binRes = await request(app)
      .get(`/api/bins/${res.body.results[0].bin_id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.name).toBe('My Bin');
  });

  it('add_items adds items to existing bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'add_items', bin_id: bin.id, items: ['wrench', 'hammer'] }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify items are on the bin
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    const itemNames = binRes.body.items.map((i: { name: string }) => i.name);
    expect(itemNames).toContain('wrench');
    expect(itemNames).toContain('hammer');
  });

  it('remove_items removes items from a bin', async () => {
    const bin = await createTestBin(app, token, locationId, { items: ['apple', 'banana'] });
    const res = await batch({ locationId, operations: [{ type: 'remove_items', bin_id: bin.id, items: ['apple'] }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify item was removed
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    const itemNames = binRes.body.items.map((i: { name: string }) => i.name);
    expect(itemNames).not.toContain('apple');
    expect(itemNames).toContain('banana');
  });

  it('add_tags adds tags to a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'add_tags', bin_id: bin.id, tags: ['urgent', 'fragile'] }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify tags on the bin
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.tags).toContain('urgent');
    expect(binRes.body.tags).toContain('fragile');
  });

  it('remove_tags removes tags from a bin', async () => {
    const bin = await createTestBin(app, token, locationId, { tags: ['red', 'blue'] });
    const res = await batch({ locationId, operations: [{ type: 'remove_tags', bin_id: bin.id, tags: ['red'] }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify tag was removed
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.tags).not.toContain('red');
    expect(binRes.body.tags).toContain('blue');
  });

  it('set_notes mode=set sets notes', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'set_notes', bin_id: bin.id, mode: 'set', notes: 'hello' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify notes were set
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.notes).toBe('hello');
  });

  it('set_notes mode=append appends notes', async () => {
    const bin = await createTestBin(app, token, locationId, { notes: 'first' });
    const res = await batch({ locationId, operations: [{ type: 'set_notes', bin_id: bin.id, mode: 'append', notes: ' second' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify notes were appended
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.notes).toBe('first\n second');
  });

  it('set_notes mode=clear clears notes', async () => {
    const bin = await createTestBin(app, token, locationId, { notes: 'some notes' });
    const res = await batch({ locationId, operations: [{ type: 'set_notes', bin_id: bin.id, mode: 'clear', notes: '' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify notes were cleared
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.notes).toBe('');
  });

  it('set_icon sets icon on a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'set_icon', bin_id: bin.id, icon: 'box' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify icon was set
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.icon).toBe('box');
  });

  it('set_color sets color on a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'set_color', bin_id: bin.id, color: '#ff0000' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify color was set
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.color).toBe('#ff0000');
  });

  it('delete_bin soft deletes a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'delete_bin', bin_id: bin.id }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify bin is in trash (GET returns 404 for soft-deleted, but trash endpoint has it)
    const trashRes = await request(app)
      .get('/api/bins/trash')
      .set('Authorization', `Bearer ${token}`)
      .query({ location_id: locationId });
    expect(trashRes.status).toBe(200);
    const trashedIds = trashRes.body.results.map((b: { id: string }) => b.id);
    expect(trashedIds).toContain(bin.id);
  });

  it('restore_bin restores a soft-deleted bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    await batch({ locationId, operations: [{ type: 'delete_bin', bin_id: bin.id }] });
    const res = await batch({ locationId, operations: [{ type: 'restore_bin', bin_id: bin.id }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify bin is accessible again
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.id).toBe(bin.id);
  });

  it('duplicate_bin duplicates a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const res = await batch({ locationId, operations: [{ type: 'duplicate_bin', bin_id: bin.id }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[0].bin_id).toBeTruthy();
    expect(res.body.results[0].bin_id).not.toBe(bin.id);
  });

  it('pin_bin and unpin_bin work', async () => {
    const bin = await createTestBin(app, token, locationId);
    const pinRes = await batch({ locationId, operations: [{ type: 'pin_bin', bin_id: bin.id }] });
    expect(pinRes.status).toBe(200);
    expect(pinRes.body.results[0].success).toBe(true);

    const unpinRes = await batch({ locationId, operations: [{ type: 'unpin_bin', bin_id: bin.id }] });
    expect(unpinRes.status).toBe(200);
    expect(unpinRes.body.results[0].success).toBe(true);
  });

  it('set_area assigns area to a bin', async () => {
    const bin = await createTestBin(app, token, locationId);
    const area = await createTestArea(app, token, locationId, 'Shelf A');
    const res = await batch({ locationId, operations: [{ type: 'set_area', bin_id: bin.id, area_name: 'Shelf A', area_id: area.id }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);

    // Verify area was assigned
    const binRes = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.area_id).toBe(area.id);
    expect(binRes.body.area_name).toBe('Shelf A');
  });

  it('multiple operations execute in order', async () => {
    const res = await batch({
      locationId,
      operations: [
        { type: 'create_bin', name: 'Bin A' },
        { type: 'create_bin', name: 'Bin B' },
        { type: 'create_bin', name: 'Bin C' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every((r: { success: boolean }) => r.success)).toBe(true);
    // All should have distinct bin_ids
    const ids = res.body.results.map((r: { bin_id: string }) => r.bin_id);
    expect(new Set(ids).size).toBe(3);
  });

  // --- Error handling ---

  it('operation referencing non-existent bin returns error in results', async () => {
    const res = await batch({ locationId, operations: [{ type: 'add_items', bin_id: 'NONEXIST', items: ['x'] }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  // --- Cross-location IDOR prevention ---

  it('rejects batch operations targeting bins in another location', async () => {
    // Create a second user with their own location and bin
    const victim = await createTestUser(app);
    const victimLoc = await createTestLocation(app, victim.token, 'Victim Location');
    const victimBin = await createTestBin(app, victim.token, victimLoc.id, { name: 'Secret Bin', items: ['secret-item'] });

    // Attacker tries to operate on victim's bin using attacker's own locationId
    const deleteRes = await batch({
      locationId,
      operations: [{ type: 'delete_bin', bin_id: victimBin.id }],
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.results[0].success).toBe(false);

    // Verify victim's bin is NOT deleted
    const binRes = await request(app)
      .get(`/api/bins/${victimBin.id}`)
      .set('Authorization', `Bearer ${victim.token}`);
    expect(binRes.status).toBe(200);
    expect(binRes.body.name).toBe('Secret Bin');
  });

  it('rejects add_items on a bin from another location', async () => {
    const victim = await createTestUser(app);
    const victimLoc = await createTestLocation(app, victim.token);
    const victimBin = await createTestBin(app, victim.token, victimLoc.id, { name: 'Target Bin' });

    const res = await batch({
      locationId,
      operations: [{ type: 'add_items', bin_id: victimBin.id, items: ['injected'] }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(false);

    // Verify no items were injected
    const binRes = await request(app)
      .get(`/api/bins/${victimBin.id}`)
      .set('Authorization', `Bearer ${victim.token}`);
    expect(binRes.status).toBe(200);
    const itemNames = binRes.body.items.map((i: { name: string }) => i.name);
    expect(itemNames).not.toContain('injected');
  });

  it('rejects duplicate_bin on a bin from another location', async () => {
    const victim = await createTestUser(app);
    const victimLoc = await createTestLocation(app, victim.token);
    const victimBin = await createTestBin(app, victim.token, victimLoc.id, { name: 'Confidential', items: ['top-secret'] });

    const res = await batch({
      locationId,
      operations: [{ type: 'duplicate_bin', bin_id: victimBin.id }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(false);
  });

  it('mixed success/failure: bad op does not block others in transaction', async () => {
    const res = await batch({
      locationId,
      operations: [
        { type: 'create_bin', name: 'Good Bin' },
        { type: 'add_items', bin_id: 'NONEXIST', items: ['x'] },
        { type: 'create_bin', name: 'Another Good Bin' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[1].success).toBe(false);
    expect(res.body.results[2].success).toBe(true);
  });
});
