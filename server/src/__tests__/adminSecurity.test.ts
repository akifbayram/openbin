import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { createTestUser, makeAdmin } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('POST /api/admin/security/force-password-change/:id', () => {
  it('sets force_password_change flag on a user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app, { email: `target_${Date.now()}@test.local` });

    const res = await request(app)
      .post(`/api/admin/security/force-password-change/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password change/i);

    const db = getDb();
    const row = db.prepare('SELECT force_password_change FROM users WHERE id = ?').get(target.id) as { force_password_change: number };
    expect(row.force_password_change).toBe(1);
  });

  it('clears force_password_change flag when enabled is false', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app, { email: `target2_${Date.now()}@test.local` });

    const db = getDb();
    db.prepare('UPDATE users SET force_password_change = 1 WHERE id = ?').run(target.id);

    const res = await request(app)
      .post(`/api/admin/security/force-password-change/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });

    expect(res.status).toBe(200);
    const row = db.prepare('SELECT force_password_change FROM users WHERE id = ?').get(target.id) as { force_password_change: number };
    expect(row.force_password_change).toBe(0);
  });

  it('returns 404 for non-existent user', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/security/force-password-change/nonexistent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('logs an audit entry', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: target } = await createTestUser(app, { email: `audit_target_${Date.now()}@test.local` });

    await request(app)
      .post(`/api/admin/security/force-password-change/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    const db = getDb();
    const audit = db.prepare("SELECT * FROM admin_audit_log WHERE action = 'force_password_change'").get() as any;
    expect(audit).toBeTruthy();
    expect(audit.target_id).toBe(target.id);
  });
});

describe('Login rejects users with force_password_change', () => {
  it('returns FORCE_PASSWORD_CHANGE error code on login', async () => {
    const password = 'TestPass123!';
    const email = `fpc_user_${Date.now()}@test.local`;
    const { user } = await createTestUser(app, { email, password });

    const db = getDb();
    db.prepare('UPDATE users SET force_password_change = 1 WHERE id = ?').run(user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORCE_PASSWORD_CHANGE');
  });

  it('allows login after password is changed', async () => {
    const password = 'TestPass123!';
    const email = `fpc_clear_${Date.now()}@test.local`;
    const { user } = await createTestUser(app, { email, password });

    const db = getDb();
    db.prepare('UPDATE users SET force_password_change = 1 WHERE id = ?').run(user.id);

    // Should fail
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(failRes.status).toBe(403);

    // Clear the flag (simulating password change)
    db.prepare('UPDATE users SET force_password_change = 0 WHERE id = ?').run(user.id);

    // Should succeed
    const successRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(successRes.status).toBe(200);
  });
});

describe('POST /api/admin/security/force-logout-all', () => {
  it('bumps token_version for all users and revokes all refresh tokens', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    // Create a second user
    const { user: other } = await createTestUser(app, { email: `other_${Date.now()}@test.local` });

    // Verify initial token_version is 0
    const db = getDb();
    const before = db.prepare('SELECT token_version FROM users WHERE id = ?').get(user.id) as { token_version: number };
    expect(before.token_version).toBe(0);

    const res = await request(app)
      .post('/api/admin/security/force-logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/revoked/i);

    // Verify token_version bumped for both users
    const afterAdmin = db.prepare('SELECT token_version FROM users WHERE id = ?').get(user.id) as { token_version: number };
    const afterOther = db.prepare('SELECT token_version FROM users WHERE id = ?').get(other.id) as { token_version: number };
    expect(afterAdmin.token_version).toBe(1);
    expect(afterOther.token_version).toBe(1);

    // Verify all refresh tokens are revoked
    const activeTokens = db.prepare('SELECT COUNT(*) as cnt FROM refresh_tokens WHERE revoked_at IS NULL').get() as { cnt: number };
    expect(activeTokens.cnt).toBe(0);
  });

  it('returns 403 for non-admin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/admin/security/force-logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('logs an audit entry', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    await request(app)
      .post('/api/admin/security/force-logout-all')
      .set('Authorization', `Bearer ${token}`);

    const db = getDb();
    const audit = db.prepare("SELECT * FROM admin_audit_log WHERE action = 'force_logout_all'").get() as any;
    expect(audit).toBeTruthy();
    expect(audit.actor_id).toBe(user.id);
    expect(audit.target_type).toBe('system');
  });
});
