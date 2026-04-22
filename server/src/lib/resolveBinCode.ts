import { query } from '../db.js';

/**
 * Resolve a bin's short code to its UUID within a location. Case-insensitive.
 * Does NOT filter by deleted_at — short codes are unique per location across
 * live and trashed bins, and restore_bin resolves codes pointing into trash.
 */
export async function resolveBinCode(locationId: string, code: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM bins WHERE location_id = $1 AND UPPER(short_code) = UPPER($2)',
    [locationId, code],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * Batch form of resolveBinCode — one SQL round-trip for many codes. Returns a
 * Map keyed by UPPERCASE short code; callers look up with `code.toUpperCase()`.
 * Unresolved codes are absent from the map.
 */
export async function resolveBinCodes(locationId: string, codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const unique = [...new Set(codes.map((c) => c.toUpperCase()))];
  const placeholders = unique.map((_, i) => `$${i + 2}`).join(', ');
  const result = await query<{ id: string; short_code: string }>(
    `SELECT id, short_code FROM bins WHERE location_id = $1 AND UPPER(short_code) IN (${placeholders})`,
    [locationId, ...unique],
  );
  return new Map(result.rows.map((r) => [r.short_code.toUpperCase(), r.id]));
}
