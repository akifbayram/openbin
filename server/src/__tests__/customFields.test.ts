import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('Custom Fields API', () => {
  let token: string;
  let locationId: string;

  beforeEach(async () => {
    const user = await createTestUser(app);
    token = user.token;
    const location = await createTestLocation(app, token);
    locationId = location.id;
  });

  const listFields = () =>
    request(app)
      .get(`/api/locations/${locationId}/custom-fields`)
      .set('Authorization', `Bearer ${token}`);

  const createField = (name: string) =>
    request(app)
      .post(`/api/locations/${locationId}/custom-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

  it('GET returns empty list for new location', async () => {
    const res = await listFields();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], count: 0 });
  });

  it('POST creates a field (201)', async () => {
    const res = await createField('Serial Number');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Serial Number',
      location_id: locationId,
      position: 0,
    });
    expect(res.body.id).toBeDefined();
  });

  it('GET returns created field', async () => {
    await createField('Weight');
    const res = await listFields();
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toBe('Weight');
  });

  it('POST second field gets next position', async () => {
    await createField('Field A');
    const res = await createField('Field B');
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(1);
  });

  it('POST rejects name > 100 chars (422)', async () => {
    const res = await createField('x'.repeat(101));
    expect(res.status).toBe(422);
  });

  it('POST rejects missing name (422)', async () => {
    const res = await request(app)
      .post(`/api/locations/${locationId}/custom-fields`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('PUT updates field name', async () => {
    const field = (await createField('Old Name')).body;
    const res = await request(app)
      .put(`/api/locations/${locationId}/custom-fields/${field.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('PUT updates field position', async () => {
    const field = (await createField('Pos Field')).body;
    const res = await request(app)
      .put(`/api/locations/${locationId}/custom-fields/${field.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ position: 5 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(5);
  });

  it('PUT 404 for non-existent field', async () => {
    const res = await request(app)
      .put(`/api/locations/${locationId}/custom-fields/nonexistent-id`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('PUT /reorder updates positions', async () => {
    const a = (await createField('A')).body;
    const b = (await createField('B')).body;
    const c = (await createField('C')).body;

    const res = await request(app)
      .put(`/api/locations/${locationId}/custom-fields/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_ids: [c.id, a.id, b.id] });
    expect(res.status).toBe(200);

    const list = await listFields();
    const positions = list.body.results.map((f: { id: string; position: number }) => ({
      id: f.id,
      position: f.position,
    }));
    expect(positions).toContainEqual({ id: c.id, position: 0 });
    expect(positions).toContainEqual({ id: a.id, position: 1 });
    expect(positions).toContainEqual({ id: b.id, position: 2 });
  });

  it('PUT /reorder 422 for empty array', async () => {
    const res = await request(app)
      .put(`/api/locations/${locationId}/custom-fields/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_ids: [] });
    expect(res.status).toBe(422);
  });

  it('DELETE removes field (204)', async () => {
    const field = (await createField('To Delete')).body;
    const res = await request(app)
      .delete(`/api/locations/${locationId}/custom-fields/${field.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await listFields();
    expect(list.body.count).toBe(0);
  });

  it('DELETE cascades to bin values', async () => {
    const field = (await createField('Cascade Field')).body;
    const bin = await createTestBin(app, token, locationId);

    // Insert a custom field value directly
    const db = getDb();
    db.prepare(
      'INSERT INTO bin_custom_field_values (bin_id, field_id, value) VALUES (?, ?, ?)',
    ).run(bin.id, field.id, 'test-value');

    // Verify it exists
    const before = db
      .prepare('SELECT * FROM bin_custom_field_values WHERE bin_id = ? AND field_id = ?')
      .get(bin.id, field.id);
    expect(before).toBeTruthy();

    // Delete the field
    await request(app)
      .delete(`/api/locations/${locationId}/custom-fields/${field.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Verify cascade
    const after = db
      .prepare('SELECT * FROM bin_custom_field_values WHERE bin_id = ? AND field_id = ?')
      .get(bin.id, field.id);
    expect(after).toBeUndefined();
  });

  it('DELETE 404 for non-existent field', async () => {
    const res = await request(app)
      .delete(`/api/locations/${locationId}/custom-fields/nonexistent-id`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('403 for non-member GET', async () => {
    const other = await createTestUser(app);
    const res = await request(app)
      .get(`/api/locations/${locationId}/custom-fields`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });

  it('403 for non-admin POST', async () => {
    const member = await createTestUser(app);
    // Join location as member
    await request(app)
      .post(`/api/locations/${locationId}/join`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ inviteCode: (await request(app)
        .get(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${token}`)).body.invite_code });

    const res = await request(app)
      .post(`/api/locations/${locationId}/custom-fields`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ name: 'Denied' });
    expect(res.status).toBe(403);
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .get(`/api/locations/${locationId}/custom-fields`);
    expect(res.status).toBe(401);
  });
});
