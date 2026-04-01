import crypto from 'node:crypto';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresEngine } from '../postgres.js';
import { isUniqueViolation } from '../shared.js';
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

describe('pg-concurrency: parallel writes', () => {
  it('10 concurrent bin INSERTs all succeed', async () => {
    const { userId, locationId } = await seedUserAndLocation();
    const inserts = Array.from({ length: 10 }, (_, i) =>
      pool.query(
        `INSERT INTO bins (id, location_id, name, created_by)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), locationId, `Bin ${i}`, userId],
      ),
    );
    await Promise.all(inserts);
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS count FROM bins WHERE location_id = $1',
      [locationId],
    );
    expect(Number(rows[0].count)).toBe(10);
  });

  it('two concurrent INSERTs with same unique key — one gets 23505', async () => {
    const username = `dup_${crypto.randomUUID().slice(0, 8)}`;
    const insert = (id: string) =>
      pool.query(
        `INSERT INTO users (id, username, password_hash, display_name, is_admin)
         VALUES ($1, $2, 'hash', 'Dup', FALSE)`,
        [id, username],
      );

    const results = await Promise.allSettled([
      insert(crypto.randomUUID()),
      insert(crypto.randomUUID()),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('isUniqueViolation() identifies 23505 from real PG constraint violation', async () => {
    const username = `uniq_${crypto.randomUUID().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin)
       VALUES ($1, $2, 'hash', 'U1', FALSE)`,
      [crypto.randomUUID(), username],
    );
    try {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, display_name, is_admin)
         VALUES ($1, $2, 'hash', 'U2', FALSE)`,
        [crypto.randomUUID(), username],
      );
      expect.fail('Should have thrown');
    } catch (err) {
      expect(isUniqueViolation(err)).toBe(true);
    }
  });
});

describe('pg-concurrency: transaction isolation', () => {
  it('two transactions modifying different bins — both commit', async () => {
    const { userId, locationId } = await seedUserAndLocation();
    const [binId1, binId2] = [crypto.randomUUID(), crypto.randomUUID()];

    // Pre-create bins
    await pool.query(
      `INSERT INTO bins (id, location_id, name, created_by) VALUES ($1, $2, 'B1', $3)`,
      [binId1, locationId, userId],
    );
    await pool.query(
      `INSERT INTO bins (id, location_id, name, created_by) VALUES ($1, $2, 'B2', $3)`,
      [binId2, locationId, userId],
    );

    await Promise.all([
      engine.withTransaction(async (txQuery) => {
        await txQuery(`UPDATE bins SET notes = 'Updated1' WHERE id = $1`, [binId1]);
      }),
      engine.withTransaction(async (txQuery) => {
        await txQuery(`UPDATE bins SET notes = 'Updated2' WHERE id = $1`, [binId2]);
      }),
    ]);

    const { rows } = await engine.query<{ id: string; notes: string }>(
      'SELECT id, notes FROM bins WHERE id IN ($1, $2) ORDER BY name',
      [binId1, binId2],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === binId1)?.notes).toBe('Updated1');
    expect(rows.find((r) => r.id === binId2)?.notes).toBe('Updated2');
  });

  it('READ COMMITTED: Transaction A sees Transaction B committed data on re-read', async () => {
    const { userId, locationId } = await seedUserAndLocation();
    const binId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO bins (id, location_id, name, notes, created_by) VALUES ($1, $2, 'RC', 'original', $3)`,
      [binId, locationId, userId],
    );

    // Use raw pool clients to control transaction timing
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await clientA.query('BEGIN');
      await clientB.query('BEGIN');

      // A reads
      const read1 = await clientA.query('SELECT notes FROM bins WHERE id = $1', [binId]);
      expect(read1.rows[0].notes).toBe('original');

      // B writes and commits
      await clientB.query(`UPDATE bins SET notes = 'modified' WHERE id = $1`, [binId]);
      await clientB.query('COMMIT');

      // A re-reads — sees committed data (READ COMMITTED)
      const read2 = await clientA.query('SELECT notes FROM bins WHERE id = $1', [binId]);
      expect(read2.rows[0].notes).toBe('modified');

      await clientA.query('COMMIT');
    } finally {
      clientA.release();
      clientB.release();
    }
  });
});

describe('pg-concurrency: pool behavior under load', () => {
  it('10 parallel queries complete within 5 seconds', async () => {
    const start = Date.now();
    const queries = Array.from({ length: 10 }, () =>
      pool.query('SELECT pg_sleep(0.1), 1 AS val'),
    );
    const results = await Promise.all(queries);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    for (const result of results) {
      expect(result.rows[0].val).toBe(1);
    }
  });
});

describe('pg-concurrency: DEFERRABLE FK in transaction', () => {
  it('insert bin then bin_items in same transaction — succeeds', async () => {
    const { userId, locationId } = await seedUserAndLocation();
    const binId = crypto.randomUUID();
    const itemId = crypto.randomUUID();

    await engine.withTransaction(async (txQuery) => {
      await txQuery(
        `INSERT INTO bins (id, location_id, name, created_by)
         VALUES ($1, $2, 'DeferBin', $3)`,
        [binId, locationId, userId],
      );
      await txQuery(
        `INSERT INTO bin_items (id, bin_id, name, position)
         VALUES ($1, $2, 'DeferItem', 0)`,
        [itemId, binId],
      );
    });

    const { rows } = await engine.query<{ name: string }>(
      'SELECT name FROM bin_items WHERE bin_id = $1',
      [binId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('DeferItem');
  });

  it('insert bin_items with non-existent bin_id — fails immediately (INITIALLY IMMEDIATE)', async () => {
    const fakeBinId = crypto.randomUUID();
    const itemId = crypto.randomUUID();

    await expect(
      engine.withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO bin_items (id, bin_id, name, position)
           VALUES ($1, $2, 'Ghost', 0)`,
          [itemId, fakeBinId],
        );
      }),
    ).rejects.toThrow();
  });
});
