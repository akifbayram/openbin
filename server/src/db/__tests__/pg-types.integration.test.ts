import crypto from 'node:crypto';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupPgTestDb, teardownPgTestDb, truncateAllPgTables } from './pg-setup.js';

let pool: pg.Pool;

beforeAll(async () => {
  pool = await setupPgTestDb();
});

afterEach(async () => {
  await truncateAllPgTables(pool);
});

afterAll(async () => {
  await teardownPgTestDb(pool);
});

// Helper: insert a user and location so FKs are satisfied
async function seedUserAndLocation(p: pg.Pool) {
  const userId = crypto.randomUUID();
  const locationId = crypto.randomUUID();
  await p.query(
    `INSERT INTO users (id, username, password_hash, display_name, is_admin)
     VALUES ($1, $2, 'hash', 'Test User', FALSE)`,
    [userId, `user_${userId.slice(0, 8)}`],
  );
  await p.query(
    `INSERT INTO locations (id, name, created_by, invite_code)
     VALUES ($1, 'Test Location', $2, $3)`,
    [locationId, userId, crypto.randomUUID()],
  );
  return { userId, locationId };
}

describe('pg-types: JSONB behavior', () => {
  it('bins.tags: JSONB array round-trips as JS array', async () => {
    const { userId, locationId } = await seedUserAndLocation(pool);
    const binId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO bins (id, location_id, name, tags, created_by)
       VALUES ($1, $2, 'Test Bin', '["tag1","tag2"]'::jsonb, $3)`,
      [binId, locationId, userId],
    );
    const { rows } = await pool.query('SELECT tags FROM bins WHERE id = $1', [binId]);
    expect(rows[0].tags).toEqual(['tag1', 'tag2']);
    expect(typeof rows[0].tags).toBe('object');
    expect(Array.isArray(rows[0].tags)).toBe(true);
  });

  it('bins.tags: empty JSONB array returns []', async () => {
    const { userId, locationId } = await seedUserAndLocation(pool);
    const binId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO bins (id, location_id, name, tags, created_by)
       VALUES ($1, $2, 'Empty Tags', '[]'::jsonb, $3)`,
      [binId, locationId, userId],
    );
    const { rows } = await pool.query('SELECT tags FROM bins WHERE id = $1', [binId]);
    expect(rows[0].tags).toEqual([]);
  });

  it('activity_log.changes: JSONB object returns JS object', async () => {
    const { userId, locationId } = await seedUserAndLocation(pool);
    const logId = crypto.randomUUID();
    const changes = { name: { old: 'A', new: 'B' } };
    await pool.query(
      `INSERT INTO activity_log (id, location_id, user_id, user_name, action, entity_type, changes)
       VALUES ($1, $2, $3, 'test', 'update', 'bin', $4::jsonb)`,
      [logId, locationId, userId, JSON.stringify(changes)],
    );
    const { rows } = await pool.query('SELECT changes FROM activity_log WHERE id = $1', [logId]);
    expect(rows[0].changes).toEqual(changes);
    expect(typeof rows[0].changes).toBe('object');
  });

  it('activity_log.changes: NULL JSONB returns SQL NULL', async () => {
    const { userId, locationId } = await seedUserAndLocation(pool);
    const logId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO activity_log (id, location_id, user_id, user_name, action, entity_type, changes)
       VALUES ($1, $2, $3, 'test', 'create', 'bin', NULL)`,
      [logId, locationId, userId],
    );
    const { rows } = await pool.query('SELECT changes FROM activity_log WHERE id = $1', [logId]);
    expect(rows[0].changes).toBeNull();
  });

  it('saved_views.filters: complex nested JSONB round-trip', async () => {
    const { userId } = await seedUserAndLocation(pool);
    const viewId = crypto.randomUUID();
    const filters = {
      tags: ['electronics', 'tools'],
      tagMode: 'all',
      area: 'workshop',
      hasItems: true,
      nested: { deep: { value: 42 } },
    };
    await pool.query(
      `INSERT INTO saved_views (id, user_id, name, filters)
       VALUES ($1, $2, 'My View', $3::jsonb)`,
      [viewId, userId, JSON.stringify(filters)],
    );
    const { rows } = await pool.query('SELECT filters FROM saved_views WHERE id = $1', [viewId]);
    expect(rows[0].filters).toEqual(filters);
  });

  it('user_print_settings.settings: JSONB object with nested keys', async () => {
    const { userId } = await seedUserAndLocation(pool);
    const settingsId = crypto.randomUUID();
    const settings = { format: 'avery5160', labelOptions: { showName: true, showTags: false } };
    await pool.query(
      `INSERT INTO user_print_settings (id, user_id, settings)
       VALUES ($1, $2, $3::jsonb)`,
      [settingsId, userId, JSON.stringify(settings)],
    );
    const { rows } = await pool.query(
      'SELECT settings FROM user_print_settings WHERE user_id = $1',
      [userId],
    );
    expect(rows[0].settings).toEqual(settings);
  });

  it('user_preferences.settings: JSONB object round-trip', async () => {
    const { userId } = await seedUserAndLocation(pool);
    const prefId = crypto.randomUUID();
    const settings = { theme: 'dark', defaultView: 'grid' };
    await pool.query(
      `INSERT INTO user_preferences (id, user_id, settings)
       VALUES ($1, $2, $3::jsonb)`,
      [prefId, userId, JSON.stringify(settings)],
    );
    const { rows } = await pool.query(
      'SELECT settings FROM user_preferences WHERE user_id = $1',
      [userId],
    );
    expect(rows[0].settings).toEqual(settings);
  });

  it('webhook_outbox.payload_json: JSONB stores and returns object', async () => {
    const outboxId = crypto.randomUUID();
    const payload = { event: 'bin.created', data: { id: '123', name: 'Test' } };
    await pool.query(
      `INSERT INTO webhook_outbox (id, endpoint, payload_json)
       VALUES ($1, 'https://example.com/webhook', $2::jsonb)`,
      [outboxId, JSON.stringify(payload)],
    );
    const { rows } = await pool.query(
      'SELECT payload_json FROM webhook_outbox WHERE id = $1',
      [outboxId],
    );
    expect(rows[0].payload_json).toEqual(payload);
    expect(typeof rows[0].payload_json).toBe('object');
  });
});

describe('pg-types: Boolean behavior', () => {
  it('users.is_admin TRUE returns JS true', async () => {
    const userId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'Admin', TRUE)`,
      [userId, `admin_${userId.slice(0, 8)}`],
    );
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    expect(rows[0].is_admin).toBe(true);
    expect(typeof rows[0].is_admin).toBe('boolean');
  });

  it('users.is_admin FALSE returns JS false', async () => {
    const userId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'User', FALSE)`,
      [userId, `user_${userId.slice(0, 8)}`],
    );
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    expect(rows[0].is_admin).toBe(false);
    expect(typeof rows[0].is_admin).toBe('boolean');
  });

  it('user_ai_settings.is_active TRUE returns JS true', async () => {
    const { userId } = await seedUserAndLocation(pool);
    const settingId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active)
       VALUES ($1, $2, 'openai', 'sk-test', 'gpt-4', TRUE)`,
      [settingId, userId],
    );
    const { rows } = await pool.query(
      'SELECT is_active FROM user_ai_settings WHERE id = $1',
      [settingId],
    );
    expect(rows[0].is_active).toBe(true);
    expect(typeof rows[0].is_active).toBe('boolean');
  });

  it('WHERE is_admin = TRUE returns correct rows', async () => {
    const adminId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'Admin', TRUE)`,
      [adminId, `admin_${adminId.slice(0, 8)}`],
    );
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'User', FALSE)`,
      [userId, `user_${userId.slice(0, 8)}`],
    );
    const { rows } = await pool.query('SELECT id FROM users WHERE is_admin = TRUE');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(adminId);
  });

  it('users.plan and sub_status remain INTEGER', async () => {
    const userId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin, plan, sub_status)
       VALUES ($1, $2, 'hash', 'User', FALSE, 1, 1)`,
      [userId, `user_${userId.slice(0, 8)}`],
    );
    const { rows } = await pool.query('SELECT plan, sub_status FROM users WHERE id = $1', [userId]);
    expect(rows[0].plan).toBe(1);
    expect(rows[0].sub_status).toBe(1);
    expect(typeof rows[0].plan).toBe('number');
  });
});

describe('pg-types: SERIAL behavior', () => {
  it('ai_usage.id auto-generates sequential IDs', async () => {
    const { userId } = await seedUserAndLocation(pool);
    await pool.query(
      `INSERT INTO ai_usage (user_id, call_count, date) VALUES ($1, 1, '2026-01-01')`,
      [userId],
    );
    await pool.query(
      `INSERT INTO ai_usage (user_id, call_count, date) VALUES ($1, 1, '2026-01-02')`,
      [userId],
    );
    const { rows } = await pool.query(
      'SELECT id FROM ai_usage WHERE user_id = $1 ORDER BY id',
      [userId],
    );
    expect(rows).toHaveLength(2);
    expect(typeof rows[0].id).toBe('number');
    expect(rows[1].id).toBe(rows[0].id + 1);
  });
});

describe('pg-types: DEFERRABLE FK behavior', () => {
  it('bin_items FK succeeds when bin exists (INITIALLY IMMEDIATE)', async () => {
    const { userId, locationId } = await seedUserAndLocation(pool);
    const binId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO bins (id, location_id, name, created_by)
       VALUES ($1, $2, 'FK Test Bin', $3)`,
      [binId, locationId, userId],
    );
    const itemId = crypto.randomUUID();
    await expect(
      pool.query(
        `INSERT INTO bin_items (id, bin_id, name, position)
         VALUES ($1, $2, 'Screwdriver', 0)`,
        [itemId, binId],
      ),
    ).resolves.toBeDefined();
  });
});
