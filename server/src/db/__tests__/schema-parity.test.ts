import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Load schema files
// ---------------------------------------------------------------------------

const schemaDir = path.join(import.meta.dirname, '..', '..', '..');
const pgSql = fs.readFileSync(path.join(schemaDir, 'schema.pg.sql'), 'utf-8');
const sqliteSql = fs.readFileSync(path.join(schemaDir, 'schema.sqlite.sql'), 'utf-8');

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseTables(sql: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)(?:^\);)/gm;
  for (const m of sql.matchAll(tableRegex)) {
    const name = m[1];
    const body = m[2];
    const cols: string[] = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // Skip constraints, empty lines, comments
      if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('UNIQUE')
        || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('CHECK')
        || trimmed.startsWith('FOREIGN')) continue;
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (colMatch) cols.push(colMatch[1]);
    }
    tables.set(name, cols);
  }
  return tables;
}

function parseIndexNames(sql: string): string[] {
  const names: string[] = [];
  const regex = /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/g;
  for (const m of sql.matchAll(regex)) {
    names.push(m[1]);
  }
  return [...new Set(names)].sort();
}

const pgTables = parseTables(pgSql);
const sqliteTables = parseTables(sqliteSql);

// ---------------------------------------------------------------------------
// Table parity
// ---------------------------------------------------------------------------

describe('schema parity — tables', () => {
  it('both schemas define the same set of tables', () => {
    const pgNames = [...pgTables.keys()].sort();
    const sqliteNames = [...sqliteTables.keys()].sort();
    expect(pgNames).toEqual(sqliteNames);
  });
});

// ---------------------------------------------------------------------------
// Column parity
// ---------------------------------------------------------------------------

describe('schema parity — columns', () => {
  // PG schema includes task_model_overrides in CREATE TABLE;
  // SQLite adds it via ALTER TABLE migration in init.ts
  const KNOWN_PG_ONLY_COLUMNS: Record<string, string[]> = {
    user_ai_settings: ['task_model_overrides'],
  };

  for (const [table, pgCols] of pgTables) {
    it(`${table} has the same columns in both schemas`, () => {
      const sqliteCols = sqliteTables.get(table);
      expect(sqliteCols).toBeDefined();

      const pgSet = new Set(pgCols);
      const sqliteSet = new Set(sqliteCols!);

      // Remove known PG-only columns from comparison
      const knownPgOnly = KNOWN_PG_ONLY_COLUMNS[table] ?? [];
      for (const col of knownPgOnly) pgSet.delete(col);

      expect([...pgSet].sort()).toEqual([...sqliteSet].sort());
    });
  }
});

// ---------------------------------------------------------------------------
// Type mapping: TEXT DEFAULT '[]' (SQLite) → JSONB DEFAULT '[]'::jsonb (PG)
// ---------------------------------------------------------------------------

describe('schema parity — JSONB mapping', () => {
  const jsonbColumns: [string, string][] = [
    ['bins', 'tags'],
    ['saved_views', 'filters'],
    ['user_print_settings', 'settings'],
    ['user_preferences', 'settings'],
    ['activity_log', 'changes'],
    ['webhook_outbox', 'payload_json'],
  ];

  for (const [table, col] of jsonbColumns) {
    it(`${table}.${col} is JSONB in PG and TEXT in SQLite`, () => {
      const pgBlock = pgSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );
      const sqliteBlock = sqliteSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );
      expect(pgBlock).not.toBeNull();
      expect(sqliteBlock).not.toBeNull();

      const pgLine = pgBlock![1].split('\n').find(l => l.trim().startsWith(col));
      const sqliteLine = sqliteBlock![1].split('\n').find(l => l.trim().startsWith(col));
      expect(pgLine).toBeDefined();
      expect(sqliteLine).toBeDefined();

      expect(pgLine).toMatch(/JSONB/);
      expect(sqliteLine).toMatch(/TEXT/);
    });
  }
});

// ---------------------------------------------------------------------------
// Type mapping: INTEGER DEFAULT 0 (SQLite) → BOOLEAN DEFAULT FALSE (PG)
// ---------------------------------------------------------------------------

describe('schema parity — BOOLEAN mapping', () => {
  const boolColumns: [string, string][] = [
    ['users', 'is_admin'],
    ['user_ai_settings', 'is_active'],
  ];

  for (const [table, col] of boolColumns) {
    it(`${table}.${col} is BOOLEAN in PG and INTEGER in SQLite`, () => {
      const pgBlock = pgSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );
      const sqliteBlock = sqliteSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );

      const pgLine = pgBlock![1].split('\n').find(l => l.trim().startsWith(col));
      const sqliteLine = sqliteBlock![1].split('\n').find(l => l.trim().startsWith(col));

      expect(pgLine).toMatch(/BOOLEAN/);
      expect(pgLine).toMatch(/DEFAULT FALSE/);
      expect(sqliteLine).toMatch(/INTEGER/);
      expect(sqliteLine).toMatch(/DEFAULT 0/);
    });
  }
});

// ---------------------------------------------------------------------------
// Type mapping: AUTOINCREMENT (SQLite) → SERIAL (PG) for ai_usage.id
// ---------------------------------------------------------------------------

describe('schema parity — SERIAL mapping', () => {
  it('ai_usage.id is SERIAL in PG and INTEGER AUTOINCREMENT in SQLite', () => {
    const pgBlock = pgSql.match(
      /CREATE TABLE IF NOT EXISTS ai_usage\s*\(([\s\S]*?)^\);/m,
    );
    const sqliteBlock = sqliteSql.match(
      /CREATE TABLE IF NOT EXISTS ai_usage\s*\(([\s\S]*?)^\);/m,
    );

    const pgLine = pgBlock![1].split('\n').find(l => l.trim().startsWith('id'));
    const sqliteLine = sqliteBlock![1].split('\n').find(l => l.trim().startsWith('id'));

    expect(pgLine).toMatch(/SERIAL/);
    expect(sqliteLine).toMatch(/AUTOINCREMENT/);
  });
});

// ---------------------------------------------------------------------------
// Index parity
// ---------------------------------------------------------------------------

describe('schema parity — indexes', () => {
  // Trigram indexes (gist_trgm_ops) only exist in PG — SQLite has no equivalent
  const PG_ONLY_INDEXES = new Set([
    'idx_bins_name_trgm',
    'idx_bins_notes_trgm',
    'idx_bins_short_code_trgm',
    'idx_bin_items_name_trgm',
  ]);

  it('both schemas define the same set of indexes (excluding PG-only trigram indexes)', () => {
    const pgIndexes = parseIndexNames(pgSql).filter((n) => !PG_ONLY_INDEXES.has(n));
    const sqliteIndexes = parseIndexNames(sqliteSql);
    expect(pgIndexes).toEqual(sqliteIndexes);
  });
});

// ---------------------------------------------------------------------------
// DEFERRABLE foreign keys (PG only)
// ---------------------------------------------------------------------------

describe('schema parity — DEFERRABLE FKs', () => {
  const deferrableTables = ['bin_items', 'photos', 'pinned_bins', 'scan_history', 'bin_custom_field_values'];

  for (const table of deferrableTables) {
    it(`${table} has DEFERRABLE FK in PG`, () => {
      const pgBlock = pgSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );
      expect(pgBlock).not.toBeNull();
      expect(pgBlock![1]).toMatch(/DEFERRABLE/);
    });

    it(`${table} has no DEFERRABLE in SQLite`, () => {
      const sqliteBlock = sqliteSql.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)^\\);`, 'm'),
      );
      expect(sqliteBlock).not.toBeNull();
      expect(sqliteBlock![1]).not.toMatch(/DEFERRABLE/);
    });
  }
});
