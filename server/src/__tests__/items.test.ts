import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation, createTestBin } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/items', () => {
  it('requires location_id', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it('requires membership', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns empty when no items', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns items with bin metadata', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, {
      name: 'Electronics',
      items: ['Cable', 'Adapter'],
    });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    for (const item of res.body.results) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('bin_id');
      expect(item).toHaveProperty('bin_name');
      expect(item).toHaveProperty('bin_icon');
      expect(item).toHaveProperty('bin_color');
      expect(item.bin_name).toBe('Electronics');
    }
  });

  it('searches by q param using word match', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, {
      name: 'Parts Box',
      items: ['USB Cable', 'Power Adapter'],
    });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}&q=cable`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toBe('USB Cable');
  });

  it('sorts alphabetically by default', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, {
      name: 'Box',
      items: ['Zebra', 'Alpha', 'Middle'],
    });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.results.map((r: { name: string }) => r.name);
    expect(names).toEqual(['Alpha', 'Middle', 'Zebra']);
  });

  it('sorts by bin name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Zulu Box', items: ['Item Z'] });
    await createTestBin(app, token, location.id, { name: 'Alpha Box', items: ['Item A'] });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}&sort=bin`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0].bin_name).toBe('Alpha Box');
    expect(res.body.results[1].bin_name).toBe('Zulu Box');
  });

  it('supports pagination', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, {
      name: 'Big Box',
      items: ['Item A', 'Item B', 'Item C', 'Item D'],
    });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}&limit=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.count).toBe(4);
  });

  it('excludes items from deleted bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bin = await createTestBin(app, token, location.id, {
      name: 'Doomed',
      items: ['Ghost Item'],
    });
    await createTestBin(app, token, location.id, {
      name: 'Keeper',
      items: ['Live Item'],
    });

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toBe('Live Item');
  });

  it('supports desc sort direction', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, {
      name: 'Box',
      items: ['Alpha', 'Zebra'],
    });

    const res = await request(app)
      .get(`/api/items?location_id=${location.id}&sort_dir=desc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.results.map((r: { name: string }) => r.name);
    expect(names).toEqual(['Zebra', 'Alpha']);
  });
});
