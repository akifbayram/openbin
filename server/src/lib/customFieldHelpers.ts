import { generateUuid, getDb, query } from '../db.js';

export interface CustomFieldDef {
  id: string;
  name: string;
}

/**
 * Fetch custom field definitions for a location.
 */
export async function fetchCustomFieldDefs(locationId: string): Promise<CustomFieldDef[] | undefined> {
  const result = await query<CustomFieldDef>(
    'SELECT id, name FROM location_custom_fields WHERE location_id = $1 ORDER BY position',
    [locationId],
  );
  return result.rows.length > 0 ? result.rows : undefined;
}

/**
 * Replace all custom field values for a bin (sync, transactional).
 * Accepts a Record<fieldId, value> — only non-empty values are stored.
 * Safe to call from both async route handlers and sync batch/import contexts.
 *
 * When `locationId` is provided, validates that every field ID belongs to
 * that location — prevents cross-location field injection.
 */
export function replaceCustomFieldValuesSync(
  binId: string,
  values: Record<string, string>,
  locationId?: string,
): void {
  const db = getDb();

  // Validate field IDs belong to the bin's location
  const fieldIds = Object.keys(values).filter((k) => values[k]);
  if (locationId && fieldIds.length > 0) {
    const placeholders = fieldIds.map(() => '?').join(',');
    const validRows = db
      .prepare(
        `SELECT id FROM location_custom_fields WHERE location_id = ? AND id IN (${placeholders})`,
      )
      .all(locationId, ...fieldIds) as { id: string }[];
    const validSet = new Set(validRows.map((r) => r.id));
    const invalid = fieldIds.filter((id) => !validSet.has(id));
    if (invalid.length > 0) {
      throw new Error(`Custom field(s) not found in this location: ${invalid.join(', ')}`);
    }
  }

  const deleteStmt = db.prepare('DELETE FROM bin_custom_field_values WHERE bin_id = ?');
  const insertStmt = db.prepare(
    `INSERT INTO bin_custom_field_values (id, bin_id, field_id, value) VALUES (?, ?, ?, ?)`,
  );
  db.transaction(() => {
    deleteStmt.run(binId);
    for (const [fieldId, value] of Object.entries(values)) {
      if (!value) continue;
      insertStmt.run(generateUuid(), binId, fieldId, value);
    }
  })();
}

/**
 * Replace all custom field values for a bin (async wrapper).
 */
export async function replaceCustomFieldValues(
  binId: string,
  values: Record<string, string>,
  locationId?: string,
): Promise<void> {
  replaceCustomFieldValuesSync(binId, values, locationId);
}

/**
 * Fetch custom field values for a bin as Record<fieldId, value>.
 */
export async function fetchCustomFieldValues(binId: string): Promise<Record<string, string>> {
  const result = await query<{ field_id: string; value: string }>(
    'SELECT field_id, value FROM bin_custom_field_values WHERE bin_id = $1',
    [binId],
  );
  const values: Record<string, string> = {};
  for (const row of result.rows) {
    values[row.field_id] = row.value;
  }
  return values;
}
