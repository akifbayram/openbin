type Dialect = 'sqlite' | 'postgres';

let currentDialect: Dialect = 'sqlite';

export function setDialect(dialect: Dialect): void {
  currentDialect = dialect;
}

export function getDialect(): Dialect {
  return currentDialect;
}

export const d = {
  now(): string {
    return currentDialect === 'sqlite' ? "datetime('now')" : 'NOW()::text';
  },

  today(): string {
    return currentDialect === 'sqlite' ? "date('now')" : 'CURRENT_DATE::text';
  },

  dateOf(col: string): string {
    return currentDialect === 'sqlite' ? `date(${col})` : `(${col})::date::text`;
  },

  intervalSeconds(param: string): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '+' || ${param} || ' seconds')`
      : `(NOW() + make_interval(secs => ${param}::int))::text`;
  },

  intervalDaysAgo(daysExpr: string): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '-' || ${daysExpr} || ' days')`
      : `(NOW() - (${daysExpr} || ' days')::interval)::text`;
  },

  fuzzyMatch(col: string, param: string): string {
    return currentDialect === 'sqlite'
      ? `fuzzy_match(${col}, ${param}) = 1`
      : `similarity(${col}, ${param}) > 0.3`;
  },

  jsonEachFrom(col: string, alias: string): string {
    return currentDialect === 'sqlite'
      ? `json_each(${col}) ${alias}`
      : `LATERAL jsonb_array_elements_text(${col}) AS ${alias}(value)`;
  },

  jsonEach(col: string): string {
    return currentDialect === 'sqlite'
      ? `json_each(${col})`
      : `jsonb_array_elements_text(${col})`;
  },

  jsonGroupArray(expr: string): string {
    return currentDialect === 'sqlite'
      ? `json_group_array(${expr})`
      : `json_agg(${expr})`;
  },

  jsonGroupObject(key: string, value: string): string {
    return currentDialect === 'sqlite'
      ? `json_group_object(${key}, ${value})`
      : `json_object_agg(${key}, ${value})`;
  },

  jsonObject(...pairs: string[]): string {
    const joined = pairs.join(', ');
    return currentDialect === 'sqlite'
      ? `json_object(${joined})`
      : `json_build_object(${joined})`;
  },

  nocase(): string {
    return currentDialect === 'sqlite' ? 'COLLATE NOCASE' : '';
  },

  insertOrIgnore(sql: string): string {
    if (currentDialect === 'sqlite') {
      return sql.trimStart().replace(/^INSERT /, 'INSERT OR IGNORE ');
    }
    return `${sql} ON CONFLICT DO NOTHING`;
  },

  secondsAgo(n: number): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '-${n} seconds')`
      : `(NOW() - interval '${n} seconds')::text`;
  },

  hoursAgo(n: number): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '-${n} hours')`
      : `(NOW() - interval '${n} hours')::text`;
  },

  daysAgo(n: number): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '-${n} days')`
      : `(NOW() - interval '${n} days')::text`;
  },

  daysFromNow(n: number): string {
    return currentDialect === 'sqlite'
      ? `datetime('now', '+${n} days')`
      : `(NOW() + interval '${n} days')::text`;
  },

  nullableEq(col: string, param: string): string {
    return currentDialect === 'sqlite'
      ? `${col} IS ${param}`
      : `${col} IS NOT DISTINCT FROM ${param}`;
  },

  /** Row-level lock for serializing concurrent writes. No-op on SQLite (WAL serializes). */
  forUpdate(): string {
    return currentDialect === 'sqlite' ? '' : 'FOR UPDATE';
  },

  /**
   * Compare a TEXT timestamp column against the current time in a way that
   * survives both ISO-8601 (`YYYY-MM-DDTHH:MM:SS.sssZ`, written by
   * `new Date().toISOString()`) and SQL `datetime()` (`YYYY-MM-DD HH:MM:SS`)
   * formats. Naive lexical comparison breaks across the `T` vs space
   * separator, so we normalize both sides through the dialect's date parser.
   *
   * Returns a SQL boolean expression. Operator must be a SQL comparator like
   * `'<='` or `'<'`.
   */
  tsCompareNow(col: string, op: '<' | '<=' | '>' | '>='): string {
    return currentDialect === 'sqlite'
      ? `datetime(${col}) ${op} datetime('now')`
      : `(${col})::timestamptz ${op} NOW()`;
  },
};
