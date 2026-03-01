import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestArea, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/locations/:locationId/areas', () => {
  it('returns empty list initially', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('returns areas after creating', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestArea(app, token, location.id, 'Garage');
    await createTestArea(app, token, location.id, 'Bedroom');

    const res = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe('POST /api/locations/:locationId/areas', () => {
  it('creates an area', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kitchen' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Kitchen');
    expect(res.body.location_id).toBe(location.id);
  });

  it('returns 409 for duplicate name', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestArea(app, token, location.id, 'Duplicate');

    const res = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate' });

    expect(res.status).toBe(409);
  });

  it('returns 403 for non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Sneaky' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/locations/:locationId/areas/:areaId', () => {
  it('renames an area', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const area = await createTestArea(app, token, location.id, 'Old Name');

    const res = await request(app)
      .put(`/api/locations/${location.id}/areas/${area.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 404 for non-existent area', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .put(`/api/locations/${location.id}/areas/fake-id`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/locations/:locationId/areas/:areaId', () => {
  it('deletes an area', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const area = await createTestArea(app, token, location.id, 'Deletable');

    const res = await request(app)
      .delete(`/api/locations/${location.id}/areas/${area.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify gone
    const listRes = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(0);
  });

  it('returns 404 for non-existent area', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .delete(`/api/locations/${location.id}/areas/fake-id`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
