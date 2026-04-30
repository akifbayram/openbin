import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { createTestLocation, createTestUser, makeAdmin } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('POST /api/admin/system/locations/:id/regen-invite', () => {
  it('regenerates the invite code for a location', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const location = await createTestLocation(app, token, 'Regen Test');

    const db = getDb();
    const before = db.prepare('SELECT invite_code FROM locations WHERE id = ?').get(location.id) as { invite_code: string };

    const res = await request(app)
      .post(`/api/admin/system/locations/${location.id}/regen-invite`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBeTruthy();
    expect(res.body.inviteCode).not.toBe(before.invite_code);

    // Verify DB was updated
    const after = db.prepare('SELECT invite_code FROM locations WHERE id = ?').get(location.id) as { invite_code: string };
    expect(after.invite_code).toBe(res.body.inviteCode);
  });

  it('returns 404 for non-existent location', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .post('/api/admin/system/locations/nonexistent/regen-invite')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/admin/system/locations/any-id/regen-invite')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('logs an audit entry', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const location = await createTestLocation(app, token, 'Audit Regen');

    await request(app)
      .post(`/api/admin/system/locations/${location.id}/regen-invite`)
      .set('Authorization', `Bearer ${token}`);

    const db = getDb();
    const audit = db.prepare("SELECT * FROM admin_audit_log WHERE action = 'regen_invite_code'").get() as any;
    expect(audit).toBeTruthy();
    expect(audit.target_id).toBe(location.id);
    expect(audit.target_type).toBe('location');
  });
});

describe('GET /api/admin/system/deletion-diagnostics', () => {
  it('returns zero counts when no deletions are pending', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const res = await request(app)
      .get('/api/admin/system/deletion-diagnostics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      pendingDeletionCount: 0,
      expiredPendingCount: 0,
      subscriptionOrphanCount30d: 0,
    });
  });

  it('counts users in active grace window as pending', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: u1 } = await createTestUser(app);
    const { user: u2 } = await createTestUser(app);

    const db = getDb();
    const future = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    db.prepare('UPDATE users SET deletion_scheduled_at = ? WHERE id = ?').run(future, u1.id);
    db.prepare('UPDATE users SET deletion_scheduled_at = ? WHERE id = ?').run(future, u2.id);

    const res = await request(app)
      .get('/api/admin/system/deletion-diagnostics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pendingDeletionCount).toBe(2);
    expect(res.body.expiredPendingCount).toBe(0);
  });

  it('counts users past grace window as expired (cleanup-job lag)', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);
    const { user: u1 } = await createTestUser(app);

    const db = getDb();
    const past = new Date(Date.now() - 86400 * 1000).toISOString();
    db.prepare('UPDATE users SET deletion_scheduled_at = ? WHERE id = ?').run(past, u1.id);

    const res = await request(app)
      .get('/api/admin/system/deletion-diagnostics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pendingDeletionCount).toBe(0);
    expect(res.body.expiredPendingCount).toBe(1);
  });

  it('counts subscription_orphans from the last 30 days and filters older', async () => {
    const { token, user } = await createTestUser(app);
    makeAdmin(user.id);

    const db = getDb();
    const recent = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
    const old = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    db.prepare(
      "INSERT INTO subscription_orphans (id, user_id_attempted, payload_json, received_at, reason) VALUES (?, ?, ?, ?, ?)",
    ).run('orph-1', 'gone-user-1', '{}', recent, 'user_not_found');
    db.prepare(
      "INSERT INTO subscription_orphans (id, user_id_attempted, payload_json, received_at, reason) VALUES (?, ?, ?, ?, ?)",
    ).run('orph-2', 'gone-user-2', '{}', recent, 'user_not_found');
    db.prepare(
      "INSERT INTO subscription_orphans (id, user_id_attempted, payload_json, received_at, reason) VALUES (?, ?, ?, ?, ?)",
    ).run('orph-3', 'gone-user-3', '{}', old, 'user_not_found');

    const res = await request(app)
      .get('/api/admin/system/deletion-diagnostics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscriptionOrphanCount30d).toBe(2);
  });

  it('returns 403 for non-admin users', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/admin/system/deletion-diagnostics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
