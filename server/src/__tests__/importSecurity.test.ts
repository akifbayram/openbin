import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { importLimiter } from '../lib/rateLimiters.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

async function joinLocation(app: Express, token: string, inviteCode: string) {
  await request(app)
    .post('/api/locations/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ inviteCode });
}

function makeBin(overrides?: Partial<{ id: string; name: string; createdBy: string }>) {
  return {
    id: overrides?.id ?? 'test-bin-1',
    name: overrides?.name ?? 'Test Bin',
    items: [],
    notes: '',
    tags: [],
    icon: '',
    color: '',
    createdBy: overrides?.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: [],
  };
}

// ---------------------------------------------------------------------------
// Fix 1: Replace mode restricted to admins
// ---------------------------------------------------------------------------
describe('Fix 1: replace mode admin restriction', () => {
  it('rejects replace mode for non-admin member (JSON import)', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    const member = await createTestUser(app);
    await joinLocation(app, member.token, loc.invite_code);

    const res = await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ bins: [makeBin()], mode: 'replace' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('allows replace mode for admin (JSON import)', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    const res = await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ bins: [makeBin()], mode: 'replace' });

    expect(res.status).toBe(200);
  });

  it('rejects replace mode for non-admin member (CSV import)', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    const member = await createTestUser(app);
    await joinLocation(app, member.token, loc.invite_code);

    const csv = 'Bin Name,Area,Item,Quantity,Tags\nTestBin,,TestItem,,tag1';

    const res = await request(app)
      .post(`/api/locations/${loc.id}/import/csv`)
      .set('Authorization', `Bearer ${member.token}`)
      .field('mode', 'replace')
      .attach('file', Buffer.from(csv), 'test.csv');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Fix 2: createdBy scoped to location members
// ---------------------------------------------------------------------------
describe('Fix 2: createdBy scoped to location members', () => {
  it('falls back to importing user when createdBy is not a location member', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    // outsider exists in users table but is NOT a member of this location
    const outsider = await createTestUser(app);

    const res = await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ bins: [makeBin({ createdBy: outsider.user.id })], mode: 'merge' });

    expect(res.status).toBe(200);

    const db = getDb();
    const bin = db.prepare(
      'SELECT created_by FROM bins WHERE location_id = ?',
    ).get(loc.id) as { created_by: string };
    expect(bin.created_by).toBe(admin.user.id);
  });

  it('preserves createdBy when user IS a location member', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    const member = await createTestUser(app);
    await joinLocation(app, member.token, loc.invite_code);

    const res = await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ bins: [makeBin({ createdBy: member.user.id })], mode: 'merge' });

    expect(res.status).toBe(200);

    const db = getDb();
    const bin = db.prepare(
      'SELECT created_by FROM bins WHERE location_id = ?',
    ).get(loc.id) as { created_by: string };
    expect(bin.created_by).toBe(member.user.id);
  });
});

// ---------------------------------------------------------------------------
// Fix 3: Activity logging for imports
// ---------------------------------------------------------------------------
describe('Fix 3: activity logging for imports', () => {
  it('creates import activity log entry after merge import', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ bins: [makeBin()], mode: 'merge' });

    // logActivity is fire-and-forget; give it a tick to flush
    await new Promise((r) => setTimeout(r, 100));

    const db = getDb();
    const entry = db.prepare(
      "SELECT * FROM activity_log WHERE location_id = ? AND action = 'import' AND entity_type = 'location'",
    ).get(loc.id) as { entity_name: string; entity_id: string } | undefined;

    expect(entry).toBeDefined();
    expect(entry!.entity_id).toBe(loc.id);
    expect(entry!.entity_name).toContain('merge');
  });

  it('creates replace_import log entry for replace mode', async () => {
    const admin = await createTestUser(app);
    const loc = await createTestLocation(app, admin.token);

    await request(app)
      .post(`/api/locations/${loc.id}/import`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ bins: [makeBin()], mode: 'replace' });

    await new Promise((r) => setTimeout(r, 100));

    const db = getDb();
    const replaceEntry = db.prepare(
      "SELECT * FROM activity_log WHERE location_id = ? AND action = 'replace_import'",
    ).get(loc.id);
    const importEntry = db.prepare(
      "SELECT * FROM activity_log WHERE location_id = ? AND action = 'import'",
    ).get(loc.id);

    expect(replaceEntry).toBeDefined();
    expect(importEntry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 4: Rate limiter exists
// ---------------------------------------------------------------------------
describe('Fix 4: import rate limiter', () => {
  it('exports importLimiter as a function', () => {
    expect(importLimiter).toBeDefined();
    expect(typeof importLimiter).toBe('function');
  });
});
