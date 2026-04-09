import type Database from 'better-sqlite3';
import type pg from 'pg';
import { createLogger } from '../../lib/logger.js';
import type { Migration } from './types.js';

const log = createLogger('db:migrations');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const CREATE_TABLE_SQL_PG = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------

export function runSqliteMigrations(db: Database.Database, migrations: Migration[]): void {
  // 1. Ensure schema_migrations table exists
  db.exec(CREATE_TABLE_SQL);

  // 2. Query applied migration names
  const applied = new Set<string>(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );

  // 3. Bootstrap: if table is empty and there are known migrations, seed all as applied
  if (applied.size === 0 && migrations.length > 0) {
    log.info('No migrations recorded — bootstrapping: marking all known migrations as applied');
    const insert = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');
    const seed = db.transaction(() => {
      for (const m of migrations) {
        insert.run(m.name);
      }
    });
    seed();
    return;
  }

  // 4. Run pending migrations
  const insertApplied = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    // 5. No sqlite function -> mark as applied without running
    if (!migration.sqlite) {
      log.info('Skipping sqlite-less migration: ' + migration.name);
      insertApplied.run(migration.name);
      continue;
    }

    // 6. Run migration -- do NOT record if it fails
    log.info('Running migration: ' + migration.name);
    try {
      migration.sqlite(db);
    } catch (err) {
      log.error('Migration failed: ' + migration.name, err);
      throw err;
    }

    insertApplied.run(migration.name);
    log.info('Migration applied: ' + migration.name);
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

export async function runPostgresMigrations(pool: pg.Pool, migrations: Migration[]): Promise<void> {
  // 1. Ensure schema_migrations table exists
  await pool.query(CREATE_TABLE_SQL_PG);

  // 2. Query applied migration names
  const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set<string>(result.rows.map((r) => r.name));

  // 3. Bootstrap: if table is empty and there are known migrations, seed all as applied
  if (applied.size === 0 && migrations.length > 0) {
    log.info('No migrations recorded — bootstrapping: marking all known migrations as applied');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const m of migrations) {
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  // 4. Run pending migrations
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    // 5. No postgres function -> mark as applied without running
    if (!migration.postgres) {
      log.info('Skipping postgres-less migration: ' + migration.name);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      continue;
    }

    log.info('Running migration: ' + migration.name);
    try {
      await migration.postgres(pool);
    } catch (err) {
      log.error('Migration failed: ' + migration.name, err);
      throw err;
    }
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);

    log.info('Migration applied: ' + migration.name);
  }
}
