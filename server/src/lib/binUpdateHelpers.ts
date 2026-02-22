import { query, getDb, generateUuid } from '../db.js';

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
  const setClauses: string[] = ["updated_at = datetime('now')"];
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
    'SELECT name FROM bin_items WHERE bin_id = $1 ORDER BY position',
    [binId]
  );
  const oldItemNames = oldItemsResult.rows.map((r) => r.name);

  const db = getDb();
  const deleteStmt = db.prepare('DELETE FROM bin_items WHERE bin_id = ?');
  const insertStmt = db.prepare('INSERT INTO bin_items (id, bin_id, name, position) VALUES (?, ?, ?, ?)');
  const runReplace = db.transaction(() => {
    deleteStmt.run(binId);
    for (let i = 0; i < newItems.length; i++) {
      const itemName = typeof newItems[i] === 'string' ? newItems[i] : (newItems[i] as { name: string }).name;
      if (!itemName) continue;
      insertStmt.run(generateUuid(), binId, itemName, i);
    }
  });
  runReplace();

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
