import crypto from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { d, setDialect } from '../dialect.js';
import { createPostgresEngine } from '../postgres.js';
import type { DatabaseEngine } from '../types.js';
import { setupPgTestDb, teardownPgTestDb, } from './pg-setup.js';

let pool: pg.Pool;
let engine: DatabaseEngine;

// Seed data IDs
let userId: string;
let locationId: string;
const binIds: string[] = [];

beforeAll(async () => {
  pool = await setupPgTestDb();
  engine = createPostgresEngine();
  setDialect('postgres');

  // Seed standard dataset
  userId = crypto.randomUUID();
  locationId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name, is_admin)
     VALUES ($1, 'queryuser', 'hash', 'Query User', FALSE)`,
    [userId],
  );
  await pool.query(
    `INSERT INTO locations (id, name, created_by, invite_code)
     VALUES ($1, 'Query Location', $2, $3)`,
    [locationId, userId, crypto.randomUUID()],
  );

  // Create an area
  const areaId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO areas (id, location_id, name, created_by)
     VALUES ($1, $2, 'Workshop', $3)`,
    [areaId, locationId, userId],
  );

  // 5 bins with varied data
  const bins = [
    { name: 'Screwdrivers', tags: ['tools', 'hardware'], area: areaId, notes: 'Phillips and flathead' },
    { name: 'Nails and Screws', tags: ['hardware', 'fasteners'], area: areaId, notes: 'Various sizes' },
    { name: 'Paint Brushes', tags: ['art', 'supplies'], area: null, notes: 'Watercolor and acrylic' },
    { name: 'Batteries', tags: ['electronics', 'power'], area: null, notes: 'AA and AAA' },
    { name: 'Empty Bin', tags: [], area: null, notes: '' },
  ];

  for (const bin of bins) {
    const binId = crypto.randomUUID();
    binIds.push(binId);
    await pool.query(
      `INSERT INTO bins (id, location_id, name, tags, area_id, notes, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [binId, locationId, bin.name, JSON.stringify(bin.tags), bin.area, bin.notes, userId],
    );
  }

  // Add items to first bin
  await pool.query(
    `INSERT INTO bin_items (id, bin_id, name, quantity, position)
     VALUES ($1, $2, 'Phillips #2', 5, 0), ($3, $2, 'Flathead Small', 3, 1)`,
    [crypto.randomUUID(), binIds[0], crypto.randomUUID()],
  );

  // Add a custom field
  const fieldId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO location_custom_fields (id, location_id, name, position)
     VALUES ($1, $2, 'Brand', 0)`,
    [fieldId, locationId],
  );
  await pool.query(
    `INSERT INTO bin_custom_field_values (id, bin_id, field_id, value)
     VALUES ($1, $2, $3, 'DeWalt')`,
    [crypto.randomUUID(), binIds[0], fieldId],
  );
});

afterAll(async () => {
  await teardownPgTestDb(pool);
});

describe('pg-queries: fuzzy search (pg_trgm)', () => {
  it('similarity() finds bin by approximate name', async () => {
    const result = await engine.query<{ name: string }>(
      `SELECT name FROM bins WHERE ${d.fuzzyMatch('name', '$1')}`,
      ['Screwdrivrs'],
    );
    expect(result.rows.some((r) => r.name === 'Screwdrivers')).toBe(true);
  });

  it('similarity() returns 0 for completely unrelated terms', async () => {
    const result = await engine.query<{ sim: number }>(
      `SELECT similarity(name, $1) AS sim FROM bins WHERE name = 'Screwdrivers'`,
      ['xyzzyplugh'],
    );
    expect(result.rows[0].sim).toBeLessThan(0.3);
  });

  it('search across bin name, notes, items, tags, area, custom fields', async () => {
    // Search for "DeWalt" should hit via custom field value
    const result = await engine.query<{ id: string }>(
      `SELECT DISTINCT b.id FROM bins b
       LEFT JOIN bin_items bi ON bi.bin_id = b.id
       LEFT JOIN bin_custom_field_values cfv ON cfv.bin_id = b.id
       LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $2 AND (
         ${d.fuzzyMatch('b.name', '$1')}
         OR ${d.fuzzyMatch('b.notes', '$1')}
         OR ${d.fuzzyMatch('COALESCE(bi.name, \'\')', '$1')}
         OR ${d.fuzzyMatch('COALESCE(a.name, \'\')', '$1')}
         OR ${d.fuzzyMatch('COALESCE(cfv.value, \'\')', '$1')}
       )`,
      ['DeWalt', locationId],
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe('pg-queries: JSONB array queries', () => {
  it('jsonb_array_elements_text — filter bins by single tag', async () => {
    const result = await engine.query<{ name: string }>(
      `SELECT b.name FROM bins b
       WHERE b.location_id = $2 AND EXISTS (
         SELECT 1 FROM ${d.jsonEach('b.tags')} AS t(value) WHERE t.value = $1
       )`,
      ['tools', locationId],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Screwdrivers');
  });

  it('multi-tag filter with tagMode = all (COUNT DISTINCT = N)', async () => {
    const result = await engine.query<{ name: string }>(
      `SELECT b.name FROM bins b
       WHERE b.location_id = $3 AND (
         SELECT COUNT(DISTINCT t.value)
         FROM ${d.jsonEach('b.tags')} AS t(value)
         WHERE t.value IN ($1, $2)
       ) = 2`,
      ['hardware', 'tools', locationId],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Screwdrivers');
  });

  it('multi-tag filter with tagMode = any (EXISTS ... IN)', async () => {
    const result = await engine.query<{ name: string }>(
      `SELECT b.name FROM bins b
       WHERE b.location_id = $3 AND EXISTS (
         SELECT 1 FROM ${d.jsonEach('b.tags')} AS t(value)
         WHERE t.value IN ($1, $2)
       )
       ORDER BY b.name`,
      ['art', 'electronics', locationId],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.name)).toEqual(['Batteries', 'Paint Brushes']);
  });
});

describe('pg-queries: JSON aggregate functions', () => {
  it('json_agg() returns array of items', async () => {
    const result = await engine.query<{ items: Array<{ name: string }> }>(
      `SELECT ${d.jsonGroupArray(d.jsonObject("'name'", 'bi.name'))} AS items
       FROM bin_items bi
       WHERE bi.bin_id = $1`,
      [binIds[0]],
    );
    expect(Array.isArray(result.rows[0].items)).toBe(true);
    expect(result.rows[0].items).toHaveLength(2);
    expect(result.rows[0].items.map((i) => i.name).sort()).toEqual([
      'Flathead Small',
      'Phillips #2',
    ]);
  });

  it('json_object_agg() returns custom field key-value map', async () => {
    const result = await engine.query<{ fields: Record<string, string> }>(
      `SELECT ${d.jsonGroupObject('cf.name', 'cfv.value')} AS fields
       FROM bin_custom_field_values cfv
       JOIN location_custom_fields cf ON cf.id = cfv.field_id
       WHERE cfv.bin_id = $1`,
      [binIds[0]],
    );
    expect(result.rows[0].fields).toEqual({ Brand: 'DeWalt' });
  });

  it('json_build_object() builds item objects', async () => {
    const result = await engine.query<{ item: { name: string; quantity: number } }>(
      `SELECT ${d.jsonObject("'name'", 'bi.name', "'quantity'", 'bi.quantity')} AS item
       FROM bin_items bi
       WHERE bi.bin_id = $1 AND bi.name = 'Phillips #2'`,
      [binIds[0]],
    );
    expect(result.rows[0].item).toEqual({ name: 'Phillips #2', quantity: 5 });
  });
});

describe('pg-queries: time/interval expressions', () => {
  it('d.secondsAgo(30) returns valid timestamp', async () => {
    const result = await engine.query<{ ts: string }>(`SELECT ${d.secondsAgo(30)} AS ts`);
    expect(new Date(result.rows[0].ts).getTime()).not.toBeNaN();
  });

  it('d.daysAgo(7) returns valid timestamp', async () => {
    const result = await engine.query<{ ts: string }>(`SELECT ${d.daysAgo(7)} AS ts`);
    const ts = new Date(result.rows[0].ts);
    expect(ts.getTime()).not.toBeNaN();
    // Should be roughly 7 days ago
    const diff = Date.now() - ts.getTime();
    expect(diff).toBeGreaterThan(6 * 86400000);
    expect(diff).toBeLessThan(8 * 86400000);
  });

  it('d.daysFromNow(3) returns valid future timestamp', async () => {
    const result = await engine.query<{ ts: string }>(`SELECT ${d.daysFromNow(3)} AS ts`);
    const ts = new Date(result.rows[0].ts);
    expect(ts.getTime()).toBeGreaterThan(Date.now());
  });

  it('d.intervalDaysAgo(expr) returns valid timestamp', async () => {
    const result = await engine.query<{ ts: string }>(
      `SELECT ${d.intervalDaysAgo('$1')} AS ts`,
      [30],
    );
    const ts = new Date(result.rows[0].ts);
    expect(ts.getTime()).not.toBeNaN();
    const diff = Date.now() - ts.getTime();
    expect(diff).toBeGreaterThan(29 * 86400000);
  });

  it('d.intervalSeconds(expr) returns valid timestamp', async () => {
    const result = await engine.query<{ ts: string }>(
      `SELECT ${d.intervalSeconds('$1')} AS ts`,
      [3600],
    );
    const ts = new Date(result.rows[0].ts);
    expect(ts.getTime()).toBeGreaterThan(Date.now());
  });

  it('d.dateOf(d.daysAgo(7)) returns valid date string', async () => {
    const result = await engine.query<{ dt: string }>(
      `SELECT ${d.dateOf(d.daysAgo(7))} AS dt`,
    );
    // PG returns a Date object for ::date casts
    const dt = result.rows[0].dt;
    // Could be a Date object or a string depending on pg driver
    const dateStr = dt && typeof dt === 'object' && 'toISOString' in dt
      ? (dt as Date).toISOString().slice(0, 10)
      : String(dt);
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

describe('pg-queries: other PG-specific SQL', () => {
  it('d.nullableEq() matches NULL values', async () => {
    // Bin with area_id = NULL
    const result = await engine.query<{ name: string }>(
      `SELECT name FROM bins WHERE location_id = $2 AND ${d.nullableEq('area_id', '$1')}`,
      [null, locationId],
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows.some((r) => r.name === 'Paint Brushes')).toBe(true);
  });

  it('d.nullableEq() matches non-NULL values', async () => {
    // Get the area_id of the first bin
    const { rows: [bin] } = await engine.query<{ area_id: string }>(
      'SELECT area_id FROM bins WHERE name = $1',
      ['Screwdrivers'],
    );
    const result = await engine.query<{ name: string }>(
      `SELECT name FROM bins WHERE location_id = $2 AND ${d.nullableEq('area_id', '$1')}`,
      [bin.area_id, locationId],
    );
    expect(result.rows.some((r) => r.name === 'Screwdrivers')).toBe(true);
  });

  it('d.insertOrIgnore() silently skips on duplicate key', async () => {
    const _id = crypto.randomUUID();
    await engine.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)`,
      ['test_key', 'val1'],
    );
    // Should not throw on duplicate
    await engine.query(
      d.insertOrIgnore(`INSERT INTO settings (key, value) VALUES ($1, $2)`),
      ['test_key', 'val2'],
    );
    const result = await engine.query<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1',
      ['test_key'],
    );
    expect(result.rows[0].value).toBe('val1'); // original value preserved
  });

  it('d.nocase() returns empty string — PG uses default collation', async () => {
    expect(d.nocase()).toBe('');
    // Verify ORDER BY name works without COLLATE
    const result = await engine.query<{ name: string }>(
      `SELECT name FROM bins WHERE location_id = $1 ORDER BY name ${d.nocase()}`,
      [locationId],
    );
    expect(result.rows.length).toBe(5);
  });

  it('b.tags = \'[]\'::jsonb — raw PG JSONB comparison for needsOrganizing', async () => {
    const result = await engine.query<{ name: string }>(
      `SELECT name FROM bins WHERE location_id = $1 AND tags = '[]'::jsonb`,
      [locationId],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Empty Bin');
  });
});
