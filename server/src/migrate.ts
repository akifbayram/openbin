import fs from 'fs';
import path from 'path';
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

  console.log('All migrations complete');
}

try {
  migrate();
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
