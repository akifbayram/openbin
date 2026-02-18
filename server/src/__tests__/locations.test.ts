import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('POST /api/locations', () => {
  it('creates a location with creator as owner', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Home' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Home');
    expect(res.body.role).toBe('owner');
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
  it('allows owner to update', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token, 'Old Name');

    const res = await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 403 for non-owner', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken, 'Owned');

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
  it('allows owner to delete', async () => {
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

  it('returns 403 for non-owner', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

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
  it('owner can remove a member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: memberToken, user: memberUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${memberUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
  });

  it('owner cannot leave (must delete location)', async () => {
    const { token: ownerToken, user: ownerUser } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${ownerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });

  it('non-owner cannot remove others', async () => {
    const { token: ownerToken, user: ownerUser } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .delete(`/api/locations/${location.id}/members/${ownerUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/locations/:id/regenerate-invite', () => {
  it('owner can regenerate invite code', async () => {
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

  it('non-owner cannot regenerate', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);

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
