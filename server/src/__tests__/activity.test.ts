import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation, createTestBin, createTestArea } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/locations/:locationId/activity', () => {
  it('requires auth', async () => {
    const res = await request(app)
      .get('/api/locations/some-id/activity');

    expect(res.status).toBe(401);
  });

  it('requires membership', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns activity from location creation', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);

    const createEntry = res.body.results.find(
      (e: { action: string; entity_type: string }) =>
        e.action === 'create' && e.entity_type === 'location',
    );
    expect(createEntry).toBeDefined();
    expect(createEntry.entity_name).toBe(location.name);
  });

  it('logs bin creation', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Activity Bin' });

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const binCreate = res.body.results.find(
      (e: { action: string; entity_type: string; entity_name: string }) =>
        e.action === 'create' && e.entity_type === 'bin' && e.entity_name === 'Activity Bin',
    );
    expect(binCreate).toBeDefined();
    expect(binCreate.entity_id).toBe(bin.id);
  });

  it('includes display_name from users table', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id);

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);

    for (const entry of res.body.results) {
      expect(entry.display_name).toBeDefined();
      expect(typeof entry.display_name).toBe('string');
      expect(entry.display_name.length).toBeGreaterThan(0);
    }
  });

  it('filters by entity_type', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin' });
    await createTestArea(app, token, location.id, 'Area');

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity?entity_type=bin`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const entry of res.body.results) {
      expect(entry.entity_type).toBe('bin');
    }
  });

  it('filters by entity_id', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bin1 = await createTestBin(app, token, location.id, { name: 'Bin One' });
    await createTestBin(app, token, location.id, { name: 'Bin Two' });

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity?entity_id=${bin1.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    for (const entry of res.body.results) {
      expect(entry.entity_id).toBe(bin1.id);
    }
  });

  it('supports pagination', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    // Create several bins to generate multiple activity entries
    await createTestBin(app, token, location.id, { name: 'Bin A' });
    await createTestBin(app, token, location.id, { name: 'Bin B' });
    await createTestBin(app, token, location.id, { name: 'Bin C' });

    // Location creation + 3 bin creations = at least 4 entries
    const res = await request(app)
      .get(`/api/locations/${location.id}/activity?limit=2&offset=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.count).toBeGreaterThanOrEqual(4);
  });

  it('returns entries in descending order (newest first)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'First' });
    await createTestBin(app, token, location.id, { name: 'Second' });

    const res = await request(app)
      .get(`/api/locations/${location.id}/activity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(2);

    // Verify descending chronological order
    for (let i = 0; i < res.body.results.length - 1; i++) {
      const current = new Date(res.body.results[i].created_at).getTime();
      const next = new Date(res.body.results[i + 1].created_at).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
