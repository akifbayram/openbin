import { d, generateUuid, isUniqueViolation, query, withTransaction } from '../db.js';
import { computeChanges } from './activityLog.js';
import { fetchBinById } from './binQueries.js';
import { replaceCustomFieldValues } from './customFieldHelpers.js';
import { assertBinCreationAllowedTx } from './planGate.js';
import { generateShortCode } from './shortCode.js';

export function buildBinSetClauses(fields: {
  name?: unknown;
  areaId?: unknown;
  notes?: unknown;
  tags?: unknown;
  icon?: unknown;
  color?: unknown;
  cardStyle?: unknown;
  visibility?: unknown;
}): { setClauses: string[]; params: unknown[]; nextParamIdx: number } {
  const setClauses: string[] = [`updated_at = ${d.now()}`];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (fields.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(fields.name);
  }
  if (fields.areaId !== undefined) {
    setClauses.push(`area_id = $${paramIdx++}`);
    params.push(fields.areaId || null);
  }
  if (fields.notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    params.push(fields.notes);
  }
  if (fields.tags !== undefined) {
    setClauses.push(`tags = $${paramIdx++}`);
    params.push(fields.tags);
  }
  if (fields.icon !== undefined) {
    setClauses.push(`icon = $${paramIdx++}`);
    params.push(fields.icon);
  }
  if (fields.color !== undefined) {
    setClauses.push(`color = $${paramIdx++}`);
    params.push(fields.color);
  }
  if (fields.cardStyle !== undefined) {
    setClauses.push(`card_style = $${paramIdx++}`);
    params.push(fields.cardStyle);
  }
  if (fields.visibility !== undefined) {
    setClauses.push(`visibility = $${paramIdx++}`);
    params.push(fields.visibility);
  }

  return { setClauses, params, nextParamIdx: paramIdx };
}

export interface ItemChanges {
  items_added?: { old: null; new: string[] };
  items_removed?: { old: string[]; new: null };
}

export async function replaceBinItems(binId: string, newItems: unknown[]): Promise<ItemChanges | null> {
  const oldItemsResult = await query<{ name: string }>(
    'SELECT name FROM bin_items WHERE bin_id = $1 AND deleted_at IS NULL ORDER BY position',
    [binId]
  );
  const oldItemNames = oldItemsResult.rows.map((r) => r.name);

  await withTransaction(async (tx) => {
    await tx('DELETE FROM bin_items WHERE bin_id = $1', [binId]);
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const itemName = typeof item === 'string' ? item : (item as { name: string }).name;
      const itemQty = typeof item === 'object' && item !== null ? ((item as { quantity?: number | null }).quantity ?? null) : null;
      if (!itemName) continue;
      await tx(
        'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)',
        [generateUuid(), binId, itemName, itemQty, i],
      );
    }
  });

  const newItemNames = newItems.map((item) =>
    typeof item === 'string' ? item : (item as { name: string }).name
  );
  const added = newItemNames.filter((n: string) => !oldItemNames.includes(n));
  const removed = oldItemNames.filter((n) => !newItemNames.includes(n));

  if (added.length === 0 && removed.length === 0) return null;

  const changes: ItemChanges = {};
  if (added.length > 0) changes.items_added = { old: null, new: added };
  if (removed.length > 0) changes.items_removed = { old: removed, new: null };
  return changes;
}

export async function resolveAreaNameChanges(
  changes: Record<string, { old: unknown; new: unknown }>,
  oldAreaId: string | null,
  newAreaId: string | null,
): Promise<void> {
  if (!changes.area_id) return;

  const oldAreaName = oldAreaId
    ? ((await query<{ name: string }>('SELECT name FROM areas WHERE id = $1', [oldAreaId])).rows[0]?.name ?? '')
    : '';
  const newAreaName = newAreaId
    ? ((await query<{ name: string }>('SELECT name FROM areas WHERE id = $1', [newAreaId])).rows[0]?.name ?? '')
    : '';

  delete changes.area_id;
  changes.area = { old: oldAreaName || null, new: newAreaName || null };
}

/**
 * Build an activity-log diff for a bin update. Compares old DB state against
 * the incoming update fields and merges item-level changes.
 * Returns null when nothing changed.
 */
export async function buildBinUpdateDiff(
  oldBin: Record<string, unknown>,
  updates: { name?: unknown; areaId?: unknown; notes?: unknown; tags?: unknown; icon?: unknown; color?: unknown; cardStyle?: unknown; visibility?: unknown; customFields?: Record<string, string> },
  itemChanges: ItemChanges | null,
): Promise<Record<string, { old: unknown; new: unknown }> | null> {
  const newObj: Record<string, unknown> = {};
  if (updates.name !== undefined) newObj.name = updates.name;
  if (updates.areaId !== undefined) newObj.area_id = updates.areaId || null;
  if (updates.notes !== undefined) newObj.notes = updates.notes;
  if (updates.tags !== undefined) newObj.tags = updates.tags;
  if (updates.icon !== undefined) newObj.icon = updates.icon;
  if (updates.color !== undefined) newObj.color = updates.color;
  if (updates.cardStyle !== undefined) newObj.card_style = updates.cardStyle;
  if (updates.visibility !== undefined) newObj.visibility = updates.visibility;

  const binFieldChanges = computeChanges(oldBin, newObj, Object.keys(newObj));

  await resolveAreaNameChanges(
    binFieldChanges ?? {},
    oldBin.area_id as string | null,
    (newObj.area_id as string | null) ?? null,
  );

  const allChanges = { ...(binFieldChanges ?? {}), ...itemChanges };
  return Object.keys(allChanges).length > 0 ? allChanges : null;
}

export interface InsertBinFields {
  locationId: string;
  name: string;
  areaId: string | null;
  notes: string;
  tags: string[] | string;
  icon: string;
  color: string;
  cardStyle: string;
  createdBy: string;
  visibility: string;
  items: unknown[];
  customFields?: Record<string, string>;
}

/**
 * Insert a new bin with items, retrying on short-code collision.
 * Used by both create and duplicate handlers.
 *
 * When `assertLimitUserId` is provided, the plan bin-count check is performed
 * inside the transaction with a row-level lock (FOR UPDATE on PG) to prevent
 * concurrent requests from bypassing the limit.
 */
export async function insertBinWithItems(fields: InsertBinFields, assertLimitUserId?: string): Promise<Record<string, any>> {
  const binId = generateUuid();
  const maxRetries = 10;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const shortCode = generateShortCode(fields.name);

    try {
      await withTransaction(async (tx) => {
        // Enforce bin creation limit inside the transaction to prevent TOCTOU bypass
        if (assertLimitUserId) {
          await assertBinCreationAllowedTx(assertLimitUserId, tx);
        }

        await tx(
          `INSERT INTO bins (id, short_code, location_id, name, area_id, notes, tags, icon, color, card_style, created_by, visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [binId, shortCode, fields.locationId, fields.name.trim(), fields.areaId, fields.notes, fields.tags, fields.icon, fields.color, fields.cardStyle, fields.createdBy, fields.visibility]
        );

        // Insert items
        for (let i = 0; i < fields.items.length; i++) {
          const item = fields.items[i];
          const itemName = typeof item === 'string' ? item : (item as { name: string })?.name;
          if (!itemName) continue;
          await tx(
            'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, NULL, $4)',
            [generateUuid(), binId, itemName, i]
          );
        }

        // Insert custom field values
        if (fields.customFields && Object.keys(fields.customFields).length > 0) {
          await replaceCustomFieldValues(binId, fields.customFields, fields.locationId, tx);
        }
      });

      return (await fetchBinById(binId))!;
    } catch (err: unknown) {
      if (isUniqueViolation(err) && attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate unique short code');
}
