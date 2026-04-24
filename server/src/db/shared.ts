/** Columns whose TEXT/JSONB values should be parsed as JSON when returned */
export const JSON_COLUMNS = new Set(['items', 'tags', 'changes', 'settings', 'filters', 'custom_fields']);

/**
 * Check if an error is a unique constraint violation (works for both SQLite and PostgreSQL).
 * Optionally checks if the violation is on a specific constraint/index name.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; message?: string; constraint?: string };
  const isUnique =
    e.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    e.code === '23505';
  if (!isUnique || !constraint) return isUnique;
  return (e.message?.includes(constraint) ?? false) || e.constraint === constraint;
}

/** Parse JSON columns in result rows */
export function deserializeRow<T>(row: Record<string, any>): T {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (JSON_COLUMNS.has(key) && typeof result[key] === 'string') {
      try { result[key] = JSON.parse(result[key] as string); } catch { /* leave as string */ }
    }
  }
  return result as T;
}
