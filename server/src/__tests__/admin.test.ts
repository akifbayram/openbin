import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

function makeAdmin(userId: string) {
  getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
}

describe('GET /api/admin/users', () => {
  it('returns user list for admin', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.adminCount).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('filters by search query', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: other } = await createTestUser(app, { username: `searchable_${Date.now()}` });

    const res = await request(app)
      .get('/api/admin/users')
      .query({ q: other.username })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(1);
    expect(res.body.results[0].username).toBe(other.username);
  });
});

describe('POST /api/admin/users', () => {
  it('creates user with valid data (201)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: `newuser_${Date.now()}`, password: 'StrongPass1!', displayName: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.username).toBeDefined();
    expect(res.body.displayName).toBe('New User');
  });

  it('rejects duplicate username (409)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: user.username, password: 'StrongPass1!' });

    expect(res.status).toBe(409);
  });

  it('rejects missing/weak password (422)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: `weakpw_${Date.now()}`, password: '123' });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/admin/users/:id', () => {
  it('returns user detail with stats', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.binCount).toBeDefined();
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/users/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/users/:id', () => {
  it('updates user fields', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User updated');

    // Verify the field was actually changed
    const detail = await request(app)
      .get(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.displayName).toBe('Updated Name');
  });

  it('updates subStatus on a user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subStatus: 1 });

    expect(res.status).toBe(200);

    const detail = await request(app)
      .get(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.status).toBe('active');
  });

  it('updates activeUntil on a user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activeUntil: '2027-01-01T00:00:00.000Z' });

    expect(res.status).toBe(200);

    const detail = await request(app)
      .get(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.activeUntil).toBe('2027-01-01T00:00:00.000Z');
  });

  it('updates password on a user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target, password: oldPassword } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewStrongPass1!' });

    expect(res.status).toBe(200);

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: target.username, password: 'NewStrongPass1!' });
    expect(loginRes.status).toBe(200);
  });

  it('returns 422 for nothing to update', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('prevents self-demotion', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .put(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isAdmin: false });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('returns 403 when deleting self', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  // Note: "delete last admin" is unreachable via the API. The caller must be admin,
  // so there are always >= 2 admins when attempting to delete another admin.
  // The last-admin protection is meaningfully tested via PUT (self-demotion prevention above).

  it('deletes a non-admin user successfully', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deletion');

    // Verify the user detail shows deleted_at is set
    const detailRes = await request(app)
      .get(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.deletedAt).toBeTruthy();
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .delete('/api/admin/users/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/registration', () => {
  it('returns registration mode', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mode).toBeDefined();
    expect(typeof res.body.locked).toBe('boolean');
  });
});

describe('PATCH /api/admin/registration', () => {
  it('changes registration mode', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    // Clear env var so runtime override works
    delete process.env.REGISTRATION_MODE;

    const res = await request(app)
      .patch('/api/admin/registration')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('closed');

    // Verify it persisted
    const getRes = await request(app)
      .get('/api/admin/registration')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.mode).toBe('closed');
  });
});
