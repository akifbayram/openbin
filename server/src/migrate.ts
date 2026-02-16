import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const db = getDb();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    console.log(`Completed: ${file}`);
  }

  // Programmatic migrations for columns added after initial schema
  const addColumnIfMissing = (table: string, column: string, type: string) => {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Added column ${table}.${column}`);
    }
  };

  addColumnIfMissing('user_ai_settings', 'command_prompt', 'TEXT');
  addColumnIfMissing('user_ai_settings', 'query_prompt', 'TEXT');
  addColumnIfMissing('user_ai_settings', 'structure_prompt', 'TEXT');

  // Migrate items from bins.items JSON column to bin_items table
  const binsCols = db.pragma('table_info(bins)') as Array<{ name: string }>;
  if (binsCols.some((c) => c.name === 'items')) {
    console.log('Migrating items from JSON column to bin_items table...');
    const migrateItems = db.transaction(() => {
      const rows = db.prepare('SELECT id, items FROM bins').all() as Array<{ id: string; items: string | null }>;
      const insert = db.prepare(
        'INSERT INTO bin_items (id, bin_id, name, position) VALUES (?, ?, ?, ?)'
      );
      let totalItems = 0;
      for (const row of rows) {
        if (!row.items) continue;
        let parsed: string[];
        try {
          parsed = JSON.parse(row.items);
        } catch {
          continue;
        }
        if (!Array.isArray(parsed)) continue;
        for (let i = 0; i < parsed.length; i++) {
          const name = parsed[i];
          if (typeof name !== 'string' || !name) continue;
          insert.run(crypto.randomUUID(), row.id, name, i);
          totalItems++;
        }
      }
      db.exec('ALTER TABLE bins DROP COLUMN items');
      console.log(`Migrated ${totalItems} items from ${rows.length} bins`);
    });
    migrateItems();
  }

  console.log('All migrations complete');
}

try {
  migrate();
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
