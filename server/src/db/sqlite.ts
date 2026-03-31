import Database from 'better-sqlite3';
import type { DatabaseEngine, QueryResult, TxQueryFn } from './types.js';

// Module-level database handle — null until initSqlite() is called
let db: Database.Database | null = null;

// ---------------------------------------------------------------------------
// Levenshtein helpers (O(min(m,n)) space, reuses module-level buffers)
// ---------------------------------------------------------------------------

const _levBuf0 = new Int32Array(256);
const _levBuf1 = new Int32Array(256);

function levenshtein(a: string, b: string): number {
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  const m = a.length;
  const n = b.length;
  const prev = _levBuf0;
  const curr = _levBuf1;
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      curr[i] =
        a[i - 1] === b[j - 1]
          ? prev[i - 1]
          : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
    }
    for (let i = 0; i <= m; i++) prev[i] = curr[i];
  }
  return prev[m];
}

const WORD_SPLIT = /[\s\-_,./]+/;

function registerFuzzyMatch(instance: Database.Database): void {
  instance.function('fuzzy_match', { deterministic: true }, (text: unknown, term: unknown) => {
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
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/**
 * Create and configure a better-sqlite3 instance.
 * Sets WAL mode and foreign keys ON, then registers the fuzzy_match UDF.
 */
export function initSqlite(dbPath: string): Database.Database {
  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  registerFuzzyMatch(instance);
  db = instance;
  return instance;
}

/**
 * Return the raw better-sqlite3 Database handle.
 * Throws if initSqlite() has not been called yet.
 */
export function getSqliteDb(): Database.Database {
  if (!db) throw new Error('SQLite database is not initialized — call initSqlite() first');
  return db;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

/** Columns whose TEXT values should be parsed as JSON when returned */
const JSON_COLUMNS = new Set(['items', 'tags', 'changes', 'settings', 'filters', 'custom_fields']);

/**
 * Convert PostgreSQL-style $1, $2, ... placeholders to SQLite ? placeholders.
 * Returns the rewritten SQL and reordered params array.
 */
export function convertParams(
  text: string,
  params?: unknown[],
): { sql: string; orderedParams: unknown[] } {
  if (!params || params.length === 0) {
    return { sql: text, orderedParams: [] };
  }

  const regex = /\$(\d+)/g;
  let sql = '';
  let lastIndex = 0;
  const newParams: unknown[] = [];

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
export function deserializeRow<T>(row: Record<string, unknown>): T {
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
export function isReturningQuery(sql: string): boolean {
  const trimmed = sql.trimStart().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) return true;
  // RETURNING clause in INSERT/UPDATE/DELETE
  if (/\bRETURNING\b/i.test(sql)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Internal run helper (shared by engine query/querySync and transaction fn)
// ---------------------------------------------------------------------------

function runQuery<T>(sql: string, params?: unknown[]): QueryResult<T> {
  const instance = getSqliteDb();
  const { sql: convertedSql, orderedParams } = convertParams(sql, params);

  if (isReturningQuery(convertedSql)) {
    const stmt = instance.prepare(convertedSql);
    const rawRows = stmt.all(...orderedParams) as Record<string, unknown>[];
    const rows = rawRows.map((r) => deserializeRow<T>(r));
    return { rows, rowCount: rows.length };
  }

  const stmt = instance.prepare(convertedSql);
  const info = stmt.run(...orderedParams);
  return { rows: [] as T[], rowCount: info.changes };
}

// ---------------------------------------------------------------------------
// Engine factory
// ---------------------------------------------------------------------------

/**
 * Create a DatabaseEngine backed by the better-sqlite3 instance.
 * initSqlite() must be called before any engine methods are used.
 */
export function createSqliteEngine(): DatabaseEngine {
  return {
    dialect: 'sqlite',

    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      return runQuery<T>(sql, params);
    },

    querySync<T = Record<string, unknown>>(sql: string, params?: unknown[]): QueryResult<T> {
      return runQuery<T>(sql, params);
    },

    async withTransaction<T>(fn: (query: TxQueryFn) => Promise<T>): Promise<T> {
      const instance = getSqliteDb();
      let result: T;

      const txFn = instance.transaction(() => {
        const txQuery: TxQueryFn = async <R = Record<string, unknown>>(
          sql: string,
          params?: unknown[],
        ): Promise<QueryResult<R>> => {
          return runQuery<R>(sql, params);
        };

        const promise = fn(txQuery);
        // Since all awaited calls resolve synchronously (better-sqlite3 is sync),
        // the .then callback runs in the same tick.
        promise.then((r) => {
          result = r;
        });
      });

      txFn();
      return result!;
    },

    async close(): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
    },
  };
}
