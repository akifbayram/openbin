import { d, generateUuid, getDb, query } from '../db.js';

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
 * Remap a bin's custom field values from source location fields to target location fields.
 * Auto-creates missing field definitions in the target location.
 * Must be called inside a transaction (uses getDb() directly).
 */
export function remapCustomFieldsForMove(
  binId: string,
  sourceLocationId: string,
  targetLocationId: string,
  skipFieldCreation = false,
): void {
  const db = getDb();

  const binValues = db.prepare(`
    SELECT v.id, v.field_id, v.value, f.name as field_name
    FROM bin_custom_field_values v
    JOIN location_custom_fields f ON f.id = v.field_id
    WHERE v.bin_id = ? AND f.location_id = ?
  `).all(binId, sourceLocationId) as Array<{
    id: string;
    field_id: string;
    value: string;
    field_name: string;
  }>;

  const nonEmptyValues = binValues.filter(v => v.value);
  if (nonEmptyValues.length === 0) return;

  const targetFields = db.prepare(
    'SELECT id, name, position FROM location_custom_fields WHERE location_id = ? ORDER BY position'
  ).all(targetLocationId) as Array<{ id: string; name: string; position: number }>;
  const targetFieldMap = new Map(targetFields.map(f => [f.name, f.id]));
  let nextPos = targetFields.length > 0 ? targetFields[targetFields.length - 1].position + 1 : 0;

  const updateStmt = db.prepare(
`UPDATE bin_custom_field_values SET field_id = ?, updated_at = ${d.now()} WHERE id = ?`
  );
  const insertFieldStmt = db.prepare(
    'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES (?, ?, ?, ?)'
  );

  const deleteValueStmt = db.prepare('DELETE FROM bin_custom_field_values WHERE id = ?');

  for (const val of nonEmptyValues) {
    let targetFieldId = targetFieldMap.get(val.field_name);
    if (!targetFieldId) {
      if (skipFieldCreation) {
        deleteValueStmt.run(val.id);
        continue;
      }
      targetFieldId = generateUuid();
      insertFieldStmt.run(targetFieldId, targetLocationId, val.field_name, nextPos);
      nextPos++;
      targetFieldMap.set(val.field_name, targetFieldId);
    }
    if (targetFieldId !== val.field_id) {
      updateStmt.run(targetFieldId, val.id);
    }
  }
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
