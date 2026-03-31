/** Columns whose TEXT/JSONB values should be parsed as JSON when returned */
export const JSON_COLUMNS = new Set(['items', 'tags', 'changes', 'settings', 'filters', 'custom_fields']);

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
