import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const db = getDb();

  // Track which migrations have already been applied
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))');

  // Bootstrap: if tracking table is empty but DB already has tables, seed it
  // so idempotent migrations (CREATE IF NOT EXISTS) re-run safely but
  // non-idempotent ones (ALTER TABLE ADD COLUMN) are skipped.
  const trackingEmpty = (db.prepare('SELECT COUNT(*) AS c FROM _migrations').get() as any).c === 0;
  if (trackingEmpty) {
    const tableNames = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name)
    );
    const columns = (table: string) =>
      new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r: any) => r.name));

    for (const file of files) {
      let alreadyApplied = false;
      // Heuristic: check if the migration's effects are already present
      if (file === '001_init.sql') alreadyApplied = tableNames.has('locations');
      else if (file === '002_user_settings.sql') alreadyApplied = tableNames.has('user_preferences');
      else if (file === '003_terminology.sql') alreadyApplied = tableNames.has('locations') && columns('locations').has('term_bin');
      else if (file === '004_active_location.sql') alreadyApplied = tableNames.has('users') && columns('users').has('active_location_id');

      if (alreadyApplied) {
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        console.log(`Backfilled: ${file}`);
      }
    }
  }

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Already applied: ${file}`);
      continue;
    }
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`Completed: ${file}`);
  }

  console.log('All migrations complete');
}

try {
  migrate();
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
