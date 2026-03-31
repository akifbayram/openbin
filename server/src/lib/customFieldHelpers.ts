import type { TxQueryFn } from '../db.js';
import { d, generateUuid, query } from '../db.js';

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
 * Replace all custom field values for a bin.
 * Accepts a Record<fieldId, value> — only non-empty values are stored.
 *
 * When `locationId` is provided, validates that every field ID belongs to
 * that location — prevents cross-location field injection.
 *
 * When `tx` is provided, uses it (for running inside a transaction).
 * Otherwise uses the top-level `query` function.
 */
export async function replaceCustomFieldValues(
  binId: string,
  values: Record<string, string>,
  locationId?: string,
  tx?: TxQueryFn,
): Promise<void> {
  const q = tx ?? query;

  // Validate field IDs belong to the bin's location
  const fieldIds = Object.keys(values).filter((k) => values[k]);
  if (locationId && fieldIds.length > 0) {
    const placeholders = fieldIds.map((_, i) => `$${i + 2}`).join(',');
    const validResult = await q<{ id: string }>(
      `SELECT id FROM location_custom_fields WHERE location_id = $1 AND id IN (${placeholders})`,
      [locationId, ...fieldIds],
    );
    const validSet = new Set(validResult.rows.map((r) => r.id));
    const invalid = fieldIds.filter((id) => !validSet.has(id));
    if (invalid.length > 0) {
      throw new Error(`Custom field(s) not found in this location: ${invalid.join(', ')}`);
    }
  }

  await q('DELETE FROM bin_custom_field_values WHERE bin_id = $1', [binId]);
  for (const [fieldId, value] of Object.entries(values)) {
    if (!value) continue;
    await q(
      'INSERT INTO bin_custom_field_values (id, bin_id, field_id, value) VALUES ($1, $2, $3, $4)',
      [generateUuid(), binId, fieldId, value],
    );
  }
}

/**
 * Remap a bin's custom field values from source location fields to target location fields.
 * Auto-creates missing field definitions in the target location.
 *
 * When `tx` is provided, uses it (for running inside a transaction).
 * Otherwise uses the top-level `query` function.
 */
export async function remapCustomFieldsForMove(
  binId: string,
  sourceLocationId: string,
  targetLocationId: string,
  skipFieldCreation = false,
  tx?: TxQueryFn,
): Promise<void> {
  const q = tx ?? query;

  const binValuesResult = await q<{
    id: string;
    field_id: string;
    value: string;
    field_name: string;
  }>(
    `SELECT v.id, v.field_id, v.value, f.name as field_name
     FROM bin_custom_field_values v
     JOIN location_custom_fields f ON f.id = v.field_id
     WHERE v.bin_id = $1 AND f.location_id = $2`,
    [binId, sourceLocationId],
  );

  const nonEmptyValues = binValuesResult.rows.filter(v => v.value);
  if (nonEmptyValues.length === 0) return;

  const targetFieldsResult = await q<{ id: string; name: string; position: number }>(
    'SELECT id, name, position FROM location_custom_fields WHERE location_id = $1 ORDER BY position',
    [targetLocationId],
  );
  const targetFieldMap = new Map(targetFieldsResult.rows.map(f => [f.name, f.id]));
  let nextPos = targetFieldsResult.rows.length > 0 ? targetFieldsResult.rows[targetFieldsResult.rows.length - 1].position + 1 : 0;

  for (const val of nonEmptyValues) {
    let targetFieldId = targetFieldMap.get(val.field_name);
    if (!targetFieldId) {
      if (skipFieldCreation) {
        await q('DELETE FROM bin_custom_field_values WHERE id = $1', [val.id]);
        continue;
      }
      targetFieldId = generateUuid();
      await q(
        'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
        [targetFieldId, targetLocationId, val.field_name, nextPos],
      );
      nextPos++;
      targetFieldMap.set(val.field_name, targetFieldId);
    }
    if (targetFieldId !== val.field_id) {
      await q(
        `UPDATE bin_custom_field_values SET field_id = $1, updated_at = ${d.now()} WHERE id = $2`,
        [targetFieldId, val.id],
      );
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
