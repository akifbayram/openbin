import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestArea, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('hierarchical areas', () => {
  it('creates child area under parent', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent = await createTestArea(app, token, location.id, 'Garage');

    const res = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf 1', parent_id: parent.id });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Shelf 1');
    expect(res.body.parent_id).toBe(parent.id);
  });

  it('rejects parent_id from different location', async () => {
    const { token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, token);
    const loc2 = await createTestLocation(app, token);
    const parentInLoc1 = await createTestArea(app, token, loc1.id, 'Garage');

    const res = await request(app)
      .post(`/api/locations/${loc2.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf 1', parent_id: parentInLoc1.id });

    expect(res.status).toBe(422);
  });

  it('allows same name under different parents', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent1 = await createTestArea(app, token, location.id, 'Garage');
    const parent2 = await createTestArea(app, token, location.id, 'Kitchen');

    const res1 = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf', parent_id: parent1.id });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf', parent_id: parent2.id });
    expect(res2.status).toBe(201);
  });

  it('rejects duplicate name under same parent', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent = await createTestArea(app, token, location.id, 'Garage');

    await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf', parent_id: parent.id });

    const res = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf', parent_id: parent.id });

    expect(res.status).toBe(409);
  });

  it('returns parent_id and descendant_bin_count in list', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent = await createTestArea(app, token, location.id, 'Garage');

    await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf 1', parent_id: parent.id });

    const res = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const garage = res.body.results.find((a: { name: string }) => a.name === 'Garage');
    const shelf = res.body.results.find((a: { name: string }) => a.name === 'Shelf 1');
    expect(garage.parent_id).toBeNull();
    expect(shelf.parent_id).toBe(parent.id);
    expect(typeof garage.descendant_bin_count).toBe('number');
  });

  it('deleting parent cascades to children', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent = await createTestArea(app, token, location.id, 'Garage');

    await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf 1', parent_id: parent.id });

    const delRes = await request(app)
      .delete(`/api/locations/${location.id}/areas/${parent.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.descendant_area_count).toBe(1);

    const listRes = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.count).toBe(0);
  });

  it('bin query expands area filter to descendants', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const parent = await createTestArea(app, token, location.id, 'Garage');

    const childRes = await request(app)
      .post(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shelf 1', parent_id: parent.id });
    const childId = childRes.body.id;

    // Create a bin in the child area
    await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Bin', locationId: location.id, areaId: childId });

    // Filter by parent area — should include child's bins
    const binRes = await request(app)
      .get(`/api/bins?location_id=${location.id}&areas=${parent.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(binRes.status).toBe(200);
    expect(binRes.body.count).toBe(1);
    expect(binRes.body.results[0].name).toBe('Test Bin');
  });
});
