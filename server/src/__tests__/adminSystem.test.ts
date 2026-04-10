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
