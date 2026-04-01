import crypto from 'node:crypto';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresEngine } from '../postgres.js';
import type { DatabaseEngine } from '../types.js';
import { setupPgTestDb, teardownPgTestDb, truncateAllPgTables } from './pg-setup.js';

let pool: pg.Pool;
let engine: DatabaseEngine;

beforeAll(async () => {
  pool = await setupPgTestDb();
  engine = createPostgresEngine();
});

afterEach(async () => {
  await truncateAllPgTables(pool);
});

afterAll(async () => {
  await teardownPgTestDb(pool);
});

// Helper: seed prerequisite rows
async function seedUserAndLocation() {
  const userId = crypto.randomUUID();
  const locationId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name, is_admin)
     VALUES ($1, $2, 'hash', 'Test', FALSE)`,
    [userId, `u_${userId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO locations (id, name, created_by, invite_code)
     VALUES ($1, 'Loc', $2, $3)`,
    [locationId, userId, crypto.randomUUID()],
  );
  return { userId, locationId };
}

describe('pg-engine: query execution', () => {
  it('INSERT and SELECT round-trip', async () => {
    const id = crypto.randomUUID();
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, 'roundtrip', 'hash', 'RT User', FALSE)`,
      [id],
    );
    const result = await engine.query<{ username: string }>('SELECT username FROM users WHERE id = $1', [id]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].username).toBe('roundtrip');
  });

  it('parameterized query with $1, $2 binds correctly', async () => {
    const id = crypto.randomUUID();
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'Param', FALSE)`,
      [id, 'param_user'],
    );
    const result = await engine.query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1 AND display_name = $2',
      ['param_user', 'Param'],
    );
    expect(result.rows[0].id).toBe(id);
  });

  it('INSERT with RETURNING returns inserted row', async () => {
    const id = crypto.randomUUID();
    const result = await engine.query<{ id: string; username: string }>(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, 'ret_user', 'hash', 'Ret', FALSE)
       RETURNING id, username`,
      [id],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(id);
    expect(result.rows[0].username).toBe('ret_user');
  });

  it('COUNT(*) returns JavaScript Number (bigint parser)', async () => {
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, 'cnt1', 'hash', 'C1', FALSE)`,
      [crypto.randomUUID()],
    );
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, 'cnt2', 'hash', 'C2', FALSE)`,
      [crypto.randomUUID()],
    );
    const result = await engine.query<{ count: number }>('SELECT COUNT(*) AS count FROM users');
    expect(typeof result.rows[0].count).toBe('number');
    expect(result.rows[0].count).toBe(2);
  });

  it('query with no params works', async () => {
    const result = await engine.query('SELECT 1 AS val');
    expect(result.rows[0].val).toBe(1);
  });
});

describe('pg-engine: parameter serialization', () => {
  it('JS array serialized to JSONB and retrieved as JS array', async () => {
    const { userId, locationId } = await seedUserAndLocation();
    const binId = crypto.randomUUID();
    const tags = ['tag1', 'tag2'];
    await engine.query(
      `INSERT INTO bins (id, location_id, name, tags, created_by)
       VALUES ($1, $2, 'Arr Bin', $3::jsonb, $4)`,
      [binId, locationId, tags, userId],
    );
    const result = await engine.query<{ tags: string[] }>('SELECT tags FROM bins WHERE id = $1', [binId]);
    expect(result.rows[0].tags).toEqual(['tag1', 'tag2']);
  });

  it('JS array of objects round-trips through JSONB', async () => {
    const { userId } = await seedUserAndLocation();
    const prefId = crypto.randomUUID();
    const settings = { columns: [{ name: 'tags', visible: true }, { name: 'area', visible: false }] };
    await engine.query(
      `INSERT INTO user_preferences (id, user_id, settings)
       VALUES ($1, $2, $3::jsonb)`,
      [prefId, userId, JSON.stringify(settings)],
    );
    const result = await engine.query<{ settings: typeof settings }>(
      'SELECT settings FROM user_preferences WHERE id = $1',
      [prefId],
    );
    expect(result.rows[0].settings).toEqual(settings);
  });

  it('null param stores NULL, not string "null"', async () => {
    const id = crypto.randomUUID();
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin, email)
       VALUES ($1, 'null_test', 'hash', 'Null', FALSE, $2)`,
      [id, null],
    );
    const result = await engine.query<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [id]);
    expect(result.rows[0].email).toBeNull();
  });

  it('boolean true stored and returned as native true', async () => {
    const id = crypto.randomUUID();
    await engine.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, 'bool_test', 'hash', 'Bool', $2)`,
      [id, true],
    );
    const result = await engine.query<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [id]);
    expect(result.rows[0].is_admin).toBe(true);
  });
});

describe('pg-engine: transactions', () => {
  it('two inserts in a transaction — both visible after COMMIT', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await engine.withTransaction(async (txQuery) => {
      await txQuery(
        `INSERT INTO users (id, username, password_hash, display_name, is_admin)
         VALUES ($1, 'tx1', 'hash', 'TX1', FALSE)`,
        [id1],
      );
      await txQuery(
        `INSERT INTO users (id, username, password_hash, display_name, is_admin)
         VALUES ($1, 'tx2', 'hash', 'TX2', FALSE)`,
        [id2],
      );
    });
    const result = await engine.query('SELECT id FROM users WHERE id IN ($1, $2)', [id1, id2]);
    expect(result.rows).toHaveLength(2);
  });

  it('transaction ROLLBACK — neither insert visible after error', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await expect(
      engine.withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO users (id, username, password_hash, display_name, is_admin)
           VALUES ($1, 'rb1', 'hash', 'RB1', FALSE)`,
          [id1],
        );
        // Force an error
        await txQuery('INSERT INTO nonexistent_table VALUES ($1)', [id2]);
      }),
    ).rejects.toThrow();
    const result = await engine.query('SELECT id FROM users WHERE id = $1', [id1]);
    expect(result.rows).toHaveLength(0);
  });

  it('two concurrent transactions on different rows — both succeed', async () => {
    const [id1, id2] = [crypto.randomUUID(), crypto.randomUUID()];
    await Promise.all([
      engine.withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO users (id, username, password_hash, display_name, is_admin)
           VALUES ($1, 'conc1', 'hash', 'C1', FALSE)`,
          [id1],
        );
      }),
      engine.withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO users (id, username, password_hash, display_name, is_admin)
           VALUES ($1, 'conc2', 'hash', 'C2', FALSE)`,
          [id2],
        );
      }),
    ]);
    const result = await engine.query('SELECT id FROM users WHERE id IN ($1, $2)', [id1, id2]);
    expect(result.rows).toHaveLength(2);
  });

  it('transaction with query error mid-way — earlier writes rolled back', async () => {
    const userId = crypto.randomUUID();
    await expect(
      engine.withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO users (id, username, password_hash, display_name, is_admin)
           VALUES ($1, 'midway', 'hash', 'MW', FALSE)`,
          [userId],
        );
        // violate unique constraint by inserting duplicate username
        await txQuery(
          `INSERT INTO users (id, username, password_hash, display_name, is_admin)
           VALUES ($1, 'midway', 'hash', 'MW2', FALSE)`,
          [crypto.randomUUID()],
        );
      }),
    ).rejects.toThrow();
    const result = await engine.query('SELECT id FROM users WHERE username = $1', ['midway']);
    expect(result.rows).toHaveLength(0);
  });

  it('nested queries within transaction callback use same client', async () => {
    const { locationId, userId } = await seedUserAndLocation();
    const binId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    await engine.withTransaction(async (txQuery) => {
      await txQuery(
        `INSERT INTO bins (id, location_id, name, created_by)
         VALUES ($1, $2, 'TxBin', $3)`,
        [binId, locationId, userId],
      );
      // This item references the bin we just inserted in the same transaction
      await txQuery(
        `INSERT INTO bin_items (id, bin_id, name, position)
         VALUES ($1, $2, 'TxItem', 0)`,
        [itemId, binId],
      );
      const result = await txQuery<{ name: string }>(
        'SELECT name FROM bin_items WHERE bin_id = $1',
        [binId],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('TxItem');
    });
  });
});

describe('pg-engine: close behavior', () => {
  it('after pool.end(), new query throws connection error', async () => {
    // Create a separate pool + engine for this test to avoid breaking others
    const { initPostgres } = await import('../postgres.js');
    const separatePool = initPostgres('postgres://openbin_test:openbin_test@localhost:5433/openbin_test');
    // Verify it works
    await separatePool.query('SELECT 1');
    await separatePool.end();
    await expect(separatePool.query('SELECT 1')).rejects.toThrow();
  });
});
