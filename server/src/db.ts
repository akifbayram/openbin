import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
];
for (const colDef of aiSettingsMigrations) {
  try { db.exec(`ALTER TABLE user_ai_settings ADD COLUMN ${colDef}`); } catch { /* column already exists */ }
}

/** Word-boundary search: returns 1 if `term` appears at a word boundary in `text` */
db.function('word_match', { deterministic: true }, (text: unknown, term: unknown) => {
  if (!text || !term) return 0;
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'i').test(String(text)) ? 1 : 0;
});

export function getDb(): Database.Database {
  return db;
}

export function generateUuid(): string {
  return crypto.randomUUID();
}

/** Columns whose TEXT values should be parsed as JSON when returned */
const JSON_COLUMNS = new Set(['items', 'tags', 'changes', 'settings', 'filters']);

/**
 * Convert PostgreSQL-style `$1, $2, ...` placeholders to SQLite `?` placeholders.
 * Returns the rewritten SQL and reordered params array.
 */
function convertParams(text: string, params?: unknown[]): { sql: string; orderedParams: unknown[] } {
  if (!params || params.length === 0) {
    return { sql: text, orderedParams: [] };
  }

  // Find all $N references in the SQL (outside of string literals)
  const paramRefs: number[] = [];
  const regex = /\$(\d+)/g;
  let match: RegExpExecArray | null;

  // Build the new SQL with ? placeholders
  let sql = '';
  let lastIndex = 0;
  const newParams: unknown[] = [];

  // Reset regex
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    sql += text.slice(lastIndex, match.index) + '?';
    const paramIndex = parseInt(match[1], 10) - 1; // $1 -> index 0
    let value = params[paramIndex];

    // Auto-serialize arrays to JSON strings
    if (Array.isArray(value)) {
      value = JSON.stringify(value);
    }

    newParams.push(value);
    lastIndex = match.index + match[0].length;
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
  if (trimmed.startsWith('SELECT')) return true;
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
