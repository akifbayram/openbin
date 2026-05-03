import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, query } from '../db.js';
import { createApp } from '../index.js';
import { createTestUser, makeAdmin } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

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
    const searchEmail = `searchable_${Date.now()}@test.local`;
    const { user: other } = await createTestUser(app, { email: searchEmail });

    const res = await request(app)
      .get('/api/admin/users')
      .query({ q: searchEmail })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(1);
    expect(res.body.results[0].email).toBe(other.email);
  });
});

describe('POST /api/admin/users', () => {
  it('creates user with valid data (201)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `newuser_${Date.now()}@test.local`, password: 'StrongPass1!', displayName: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBeDefined();
    expect(res.body.displayName).toBe('New User');
  });

  it('rejects duplicate email (409)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: user.email, password: 'StrongPass1!', displayName: 'Duplicate' });

    expect(res.status).toBe(409);
  });

  it('rejects missing/weak password (422)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `weakpw_${Date.now()}@test.local`, password: '123', displayName: 'Weak PW' });

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
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewStrongPass1!' });

    expect(res.status).toBe(200);

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: target.email, password: 'NewStrongPass1!' });
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

describe('DELETE /api/admin/users/:id (orchestrator-backed)', () => {
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

  it('soft-deletes a non-admin user via the orchestrator and returns scheduledAt', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User scheduled for deletion');
    expect(res.body.scheduledAt).toBeTruthy();
    expect(new Date(res.body.scheduledAt).getTime()).toBeGreaterThan(Date.now());

    // Row still exists (soft-delete) with all four lifecycle fields set.
    const row = await query<{
      deleted_at: string | null;
      deletion_requested_at: string | null;
      deletion_scheduled_at: string | null;
      deletion_reason: string | null;
    }>(
      'SELECT deleted_at, deletion_requested_at, deletion_scheduled_at, deletion_reason FROM users WHERE id = $1',
      [target.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect(row.rows[0].deletion_requested_at).not.toBeNull();
    expect(row.rows[0].deletion_scheduled_at).toBe(res.body.scheduledAt);
    expect(row.rows[0].deletion_reason).toBe('admin_initiated');
  });

  it('writes a request_account_deletion entry to admin_audit_log', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const audit = getDb()
      .prepare("SELECT * FROM admin_audit_log WHERE action = 'request_account_deletion' AND target_id = ?")
      .get(target.id) as any;
    expect(audit).toBeDefined();
    expect(audit.actor_id).toBe(user.id);
    expect(audit.target_name).toBe(target.email);
  });

  it('defaults refundPolicy to "prorated" but accepts explicit "none"', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: t1 } = await createTestUser(app);
    const { user: t2 } = await createTestUser(app);

    const r1 = await request(app)
      .delete(`/api/admin/users/${t1.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .delete(`/api/admin/users/${t2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ refundPolicy: 'none' });
    expect(r2.status).toBe(200);

    // Both writes succeed; refundPolicy plumbed through to audit details.
    const a1 = getDb()
      .prepare("SELECT details FROM admin_audit_log WHERE action = 'request_account_deletion' AND target_id = ?")
      .get(t1.id) as any;
    const a2 = getDb()
      .prepare("SELECT details FROM admin_audit_log WHERE action = 'request_account_deletion' AND target_id = ?")
      .get(t2.id) as any;
    expect(JSON.parse(a1.details).refundPolicy).toBe('prorated');
    expect(JSON.parse(a2.details).refundPolicy).toBe('none');
  });

  it('succeeds when target is admin and other admins exist', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);
    makeAdmin(target.id);

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
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

describe('POST /api/admin/users/:id/recover-deletion', () => {
  async function softDeleteTarget(app: Express): Promise<{ adminToken: string; targetId: string; targetEmail: string; targetPassword: string }> {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target, password } = await createTestUser(app);
    const del = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    return { adminToken: token, targetId: target.id, targetEmail: target.email, targetPassword: password };
  }

  it('recovers a pending-deletion user and clears all lifecycle fields', async () => {
    const { adminToken, targetId } = await softDeleteTarget(app);

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/recover-deletion`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/recovered/i);

    const row = await query<{
      deleted_at: string | null;
      deletion_requested_at: string | null;
      deletion_scheduled_at: string | null;
      deletion_reason: string | null;
    }>(
      'SELECT deleted_at, deletion_requested_at, deletion_scheduled_at, deletion_reason FROM users WHERE id = $1',
      [targetId],
    );
    expect(row.rows[0].deleted_at).toBeNull();
    expect(row.rows[0].deletion_requested_at).toBeNull();
    expect(row.rows[0].deletion_scheduled_at).toBeNull();
    expect(row.rows[0].deletion_reason).toBeNull();
  });

  it('writes a recover_account_deletion entry to admin_audit_log', async () => {
    const { adminToken, targetId, targetEmail } = await softDeleteTarget(app);

    await request(app)
      .post(`/api/admin/users/${targetId}/recover-deletion`)
      .set('Authorization', `Bearer ${adminToken}`);

    const audit = getDb()
      .prepare("SELECT * FROM admin_audit_log WHERE action = 'recover_account_deletion' AND target_id = ?")
      .get(targetId) as any;
    expect(audit).toBeDefined();
    expect(audit.target_name).toBe(targetEmail);
  });

  it('lets a recovered user log in normally afterwards', async () => {
    const { adminToken, targetId, targetEmail, targetPassword } = await softDeleteTarget(app);

    await request(app)
      .post(`/api/admin/users/${targetId}/recover-deletion`)
      .set('Authorization', `Bearer ${adminToken}`);

    const login = await request(app).post('/api/auth/login').send({ email: targetEmail, password: targetPassword });
    expect(login.status).toBe(200);
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/users/nonexistent-id/recover-deletion')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when user is not pending deletion', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app);

    const res = await request(app)
      .post(`/api/admin/users/${target.id}/recover-deletion`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('returns 409 when grace period has expired', async () => {
    const { adminToken, targetId } = await softDeleteTarget(app);

    getDb()
      .prepare('UPDATE users SET deletion_scheduled_at = ?, deletion_requested_at = ? WHERE id = ?')
      .run(
        new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString(),
        targetId,
      );

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/recover-deletion`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/grace period/i);
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
