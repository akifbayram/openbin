import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = config.databasePath;

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema (all CREATE IF NOT EXISTS — safe to run on every start)
const schemaPath = path.join(__dirname, '..', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
}

// Column migrations for existing databases (ALTER TABLE ADD COLUMN errors if column exists)
const aiSettingsMigrations = [
  'temperature REAL',
  'max_tokens INTEGER',
  'top_p REAL',
  'request_timeout INTEGER',
  'reorganization_prompt TEXT',
];
for (const colDef of aiSettingsMigrations) {
  try { db.exec(`ALTER TABLE user_ai_settings ADD COLUMN ${colDef}`); } catch { /* column already exists */ }
}

try { db.exec('ALTER TABLE bin_items ADD COLUMN quantity INTEGER DEFAULT NULL'); } catch { /* column already exists */ }
try { db.exec('ALTER TABLE user_ai_settings ADD COLUMN task_model_overrides TEXT'); } catch { /* column already exists */ }

// Hierarchical areas: add parent_id column
try { db.exec('ALTER TABLE areas ADD COLUMN parent_id TEXT REFERENCES areas(id) ON DELETE CASCADE'); } catch { /* column already exists */ }

// Hierarchical areas: migrate UNIQUE constraint from (location_id, name) to (location_id, parent_id, name)
{
  const areaTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='areas'").get() as { sql: string } | undefined;
  if (areaTableInfo?.sql && !areaTableInfo.sql.includes('parent_id, name')) {
    db.exec(`
      CREATE TABLE areas_new (
        id            TEXT PRIMARY KEY,
        location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        parent_id     TEXT REFERENCES areas(id) ON DELETE CASCADE,
        created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(location_id, parent_id, name)
      );
      INSERT INTO areas_new (id, location_id, name, parent_id, created_by, created_at, updated_at)
        SELECT id, location_id, name, parent_id, created_by, created_at, updated_at FROM areas;
      DROP TABLE areas;
      ALTER TABLE areas_new RENAME TO areas;
      CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id);
      CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON areas(parent_id);
    `);
  }
}

// Viewer role: add default_join_role to locations
try { db.exec("ALTER TABLE locations ADD COLUMN default_join_role TEXT NOT NULL DEFAULT 'member' CHECK (default_join_role IN ('member', 'viewer'))"); } catch { /* column already exists */ }

// AI usage tracking (daily budget for demo users)
db.exec([
  'CREATE TABLE IF NOT EXISTS ai_usage (',
  '  id         INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  user_id    TEXT NOT NULL,',
  '  call_count INTEGER NOT NULL DEFAULT 1,',
  "  date       TEXT NOT NULL DEFAULT (date('now')),",
  "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
  '  UNIQUE(user_id, date)',
  ');',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);',
].join('\n'));

// Viewer role: widen location_members.role CHECK constraint to include 'viewer'
// SQLite can't ALTER CHECK constraints, so recreate the table if the old constraint exists
{
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='location_members'").get() as { sql: string } | undefined;
  if (tableInfo?.sql && !tableInfo.sql.includes("'viewer'")) {
    db.exec(`
      CREATE TABLE location_members_new (
        id            TEXT PRIMARY KEY,
        location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
        joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(location_id, user_id)
      );
      INSERT INTO location_members_new SELECT * FROM location_members;
      DROP TABLE location_members;
      ALTER TABLE location_members_new RENAME TO location_members;
      CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id);
    `);
  }
}

// Cloud tier: plan and subscription columns for users
try { db.exec('ALTER TABLE users ADD COLUMN plan INTEGER NOT NULL DEFAULT 1'); } catch { /* column already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN sub_status INTEGER NOT NULL DEFAULT 1'); } catch { /* column already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN active_until TEXT'); } catch { /* column already exists */ }
db.exec('CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, sub_status)');

// Global admin role
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0'); } catch { /* column already exists */ }

// Soft delete for users
try { db.exec('ALTER TABLE users ADD COLUMN deleted_at TEXT'); } catch { /* column already exists */ }

// Seed default admin account (admin/admin) — idempotent
// Pre-computed bcrypt hash for "admin" at cost 12 avoids blocking the event loop at startup
{
  const adminExists = db.prepare("SELECT 1 FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin, plan, sub_status, active_until)
       VALUES (?, 'admin', ?, 'Admin', 1, 1, 1, ?)`
    ).run(
      crypto.randomUUID(),
      '$2b$12$3s7vHxqe3VFONH86Xb5dm.Sqq6ZRWIkFNWPmfAkmx.PH.a0VCwJ1G',
      new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    );
  }
}

// Global settings key-value store (e.g. runtime registration mode override)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Bin sharing table
db.exec(`
  CREATE TABLE IF NOT EXISTS bin_shares (
    id          TEXT PRIMARY KEY,
    bin_id      TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    visibility  TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('public', 'unlisted')),
    created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    view_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at  TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_bin_shares_token ON bin_shares(token) WHERE revoked_at IS NULL;
`);

// API key daily usage tracking
db.exec(`
  CREATE TABLE IF NOT EXISTS api_key_daily_usage (
    api_key_id    TEXT NOT NULL,
    date          TEXT NOT NULL DEFAULT (date('now')),
    request_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (api_key_id, date)
  );
`);

// Email deduplication log
db.exec(`
  CREATE TABLE IF NOT EXISTS email_log (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    email_type TEXT NOT NULL,
    sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON email_log(user_id, email_type, sent_at);
`);

/** O(min(m,n)) space — reuses module-level buffers to avoid per-call allocation */
const _levBuf0 = new Int32Array(256);
const _levBuf1 = new Int32Array(256);
function levenshtein(a: string, b: string): number {
  if (a.length > b.length) { const tmp = a; a = b; b = tmp; }
  const m = a.length;
  const n = b.length;
  const prev = _levBuf0;
  const curr = _levBuf1;
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      curr[i] = a[i - 1] === b[j - 1]
        ? prev[i - 1]
        : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
    }
    for (let i = 0; i <= m; i++) prev[i] = curr[i];
  }
  return prev[m];
}

const WORD_SPLIT = /[\s\-_,./]+/;

db.function('fuzzy_match', { deterministic: true }, (text: unknown, term: unknown) => {
  const t = String(text || '').toLowerCase();
  const q = String(term || '').trim().toLowerCase();
  if (!q) return 0;

  // Substring check first — covers compound words and cross-boundary matches
  if (q.length > 2 && t.includes(q)) return 1;

  const words = t.split(WORD_SPLIT);
  const threshold = q.length <= 4 ? 1 : 2;

  for (const word of words) {
    if (!word) continue;
    if (word.startsWith(q)) return 1;
    if (q.length <= 2) continue;
    if (Math.abs(word.length - q.length) > threshold) continue;
    if (levenshtein(q, word.slice(0, q.length + 2)) <= threshold) return 1;
  }

  return 0;
});

export function getDb(): Database.Database {
  return db;
}

export function generateUuid(): string {
  return crypto.randomUUID();
}

/** Columns whose TEXT values should be parsed as JSON when returned */
const JSON_COLUMNS = new Set(['items', 'tags', 'changes', 'settings', 'filters', 'custom_fields']);

/**
 * Convert PostgreSQL-style `$1, $2, ...` placeholders to SQLite `?` placeholders.
 * Returns the rewritten SQL and reordered params array.
 */
function convertParams(text: string, params?: unknown[]): { sql: string; orderedParams: unknown[] } {
  if (!params || params.length === 0) {
    return { sql: text, orderedParams: [] };
  }

  // Find all $N references in the SQL (outside of string literals)
  const _paramRefs: number[] = [];
  const regex = /\$(\d+)/g;
  // Build the new SQL with ? placeholders
  let sql = '';
  let lastIndex = 0;
  const newParams: unknown[] = [];

  // Reset regex
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    sql += `${text.slice(lastIndex, match.index)}?`;
    const paramIndex = parseInt(match[1], 10) - 1; // $1 -> index 0
    let value = params[paramIndex];

    // Auto-serialize arrays to JSON strings
    if (Array.isArray(value)) {
      value = JSON.stringify(value);
    }

    newParams.push(value);
    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }
  sql += text.slice(lastIndex);

  return { sql, orderedParams: newParams };
}

/** Parse JSON columns in result rows */
function deserializeRow<T>(row: Record<string, any>): T {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (JSON_COLUMNS.has(key) && typeof result[key] === 'string') {
      try {
        result[key] = JSON.parse(result[key] as string);
      } catch {
        // leave as string if not valid JSON
      }
    }
  }
  return result as T;
}

/** Detect if a statement returns rows */
function isReturningQuery(sql: string): boolean {
  const trimmed = sql.trimStart().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) return true;
  // RETURNING clause in INSERT/UPDATE/DELETE
  if (/\bRETURNING\b/i.test(sql)) return true;
  return false;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** Async-compatible query wrapper (returns a resolved Promise for pg compat) */
export async function query<T = Record<string, any>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return querySync<T>(text, params);
}

/** Synchronous query — needed for transaction blocks in export.ts */
export function querySync<T = Record<string, any>>(
  text: string,
  params?: unknown[]
): QueryResult<T> {
  const { sql, orderedParams } = convertParams(text, params);

  if (isReturningQuery(sql)) {
    const stmt = db.prepare(sql);
    const rawRows = stmt.all(...orderedParams) as Record<string, any>[];
    const rows = rawRows.map(r => deserializeRow<T>(r));
    return { rows, rowCount: rows.length };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...orderedParams);
    return { rows: [] as T[], rowCount: info.changes };
  }
}
