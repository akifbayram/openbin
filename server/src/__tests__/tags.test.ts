import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation, createTestBin } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/tags', () => {
  it('requires location_id', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it('requires membership', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns empty when no bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns tags with counts from overlapping bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin 1', tags: ['tech', 'office'] });
    await createTestBin(app, token, location.id, { name: 'Bin 2', tags: ['tech', 'home'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);

    const tagMap = Object.fromEntries(
      res.body.results.map((r: { tag: string; count: number }) => [r.tag, r.count]),
    );
    expect(tagMap['tech']).toBe(2);
    expect(tagMap['office']).toBe(1);
    expect(tagMap['home']).toBe(1);
  });

  it('filters by q param', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin 1', tags: ['tech', 'office'] });
    await createTestBin(app, token, location.id, { name: 'Bin 2', tags: ['home'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}&q=tech`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].tag).toBe('tech');
  });

  it('sorts alphabetically by default (case-insensitive)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin 1', tags: ['zebra'] });
    await createTestBin(app, token, location.id, { name: 'Bin 2', tags: ['Alpha'] });
    await createTestBin(app, token, location.id, { name: 'Bin 3', tags: ['middle'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const tags = res.body.results.map((r: { tag: string }) => r.tag);
    expect(tags).toEqual(['Alpha', 'middle', 'zebra']);
  });

  it('sorts by count descending', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin 1', tags: ['rare'] });
    await createTestBin(app, token, location.id, { name: 'Bin 2', tags: ['common', 'rare'] });
    await createTestBin(app, token, location.id, { name: 'Bin 3', tags: ['common'] });
    await createTestBin(app, token, location.id, { name: 'Bin 4', tags: ['common'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}&sort=count&sort_dir=desc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0].tag).toBe('common');
    expect(res.body.results[0].count).toBe(3);
    expect(res.body.results[1].tag).toBe('rare');
    expect(res.body.results[1].count).toBe(2);
  });

  it('supports pagination with limit and offset', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'Bin 1', tags: ['alpha'] });
    await createTestBin(app, token, location.id, { name: 'Bin 2', tags: ['bravo'] });
    await createTestBin(app, token, location.id, { name: 'Bin 3', tags: ['charlie'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}&limit=2&offset=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.count).toBe(3);
  });

  it('excludes deleted bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bin = await createTestBin(app, token, location.id, { name: 'Del Bin', tags: ['ghost'] });
    await createTestBin(app, token, location.id, { name: 'Live Bin', tags: ['alive'] });

    await request(app)
      .delete(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const tags = res.body.results.map((r: { tag: string }) => r.tag);
    expect(tags).toContain('alive');
    expect(tags).not.toContain('ghost');
  });

  it('handles bins with empty tags without affecting results', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    await createTestBin(app, token, location.id, { name: 'No Tags Bin' });
    await createTestBin(app, token, location.id, { name: 'Tagged Bin', tags: ['present'] });

    const res = await request(app)
      .get(`/api/tags?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].tag).toBe('present');
    expect(res.body.results[0].count).toBe(1);
  });
});
