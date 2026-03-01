import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('POST /api/locations', () => {
  it('creates a location with creator as admin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Home' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Home');
    expect(res.body.role).toBe('admin');
    expect(res.body.member_count).toBe(1);
    expect(res.body.invite_code).toBeDefined();
  });

  it('returns 422 for missing name', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('GET /api/locations', () => {
  it('returns empty list initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns locations after creating', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token, 'Home');
    await createTestLocation(app, token, 'Office');

    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe('PUT /api/locations/:id', () => {
  it('allows admin to update', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token, 'Old Name');

    const res = await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 403 for non-admin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken, 'Owned');

    // Create second user and join
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for empty body', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/locations/:id', () => {
  it('allows admin to delete', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .delete(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify it's gone
    const list = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.count).toBe(0);
  });

  it('returns 403 for non-admin', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .delete(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/locations/join', () => {
  it('joins a location via invite code', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken, 'Shared Space');

    const { token: joinerToken } = await createTestUser(app);

    const res = await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ inviteCode: location.invite_code });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Shared Space');
    expect(res.body.role).toBe('member');
  });

  it('returns 409 for duplicate join', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: joinerToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ inviteCode: location.invite_code });

    expect(res.status).toBe(409);
  });

  it('returns 404 for invalid invite code', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ inviteCode: 'invalid-code' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/locations/:id/members', () => {
  it('lists members', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .get(`/api/locations/${location.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

describe('DELETE /api/locations/:id/members/:userId', () => {
  it('admin can remove a member', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken, user: memberUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${memberUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('last admin cannot leave', async () => {
    const { token: adminToken, user: adminUser } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(422);
  });

  it('non-admin cannot remove others', async () => {
    const { token: adminToken, user: adminUser } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${adminUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/locations/:id/regenerate-invite', () => {
  it('admin can regenerate invite code', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const oldCode = location.invite_code;

    const res = await request(app)
      .post(`/api/locations/${location.id}/regenerate-invite`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBeDefined();
    expect(res.body.inviteCode).not.toBe(oldCode);
  });

  it('non-admin cannot regenerate', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .post(`/api/locations/${location.id}/regenerate-invite`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
