import type { TxQueryFn } from '../../db.js';
import { d, generateUuid } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { type ActionContext, assertBinVisible } from './types.js';

const MAX_ITEMS_PER_ACTION = 500;

export async function handleAddItems(action: Extract<CommandAction, { type: 'add_items' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  if (action.items.length > MAX_ITEMS_PER_ACTION) throw new Error('Too many items per action (max 500)');
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>('SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  const maxResult = await tx<{ max_pos: number | null }>('SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1', [action.bin_id]);
  let nextPos = (maxResult.rows[0]?.max_pos ?? -1) + 1;
  const itemNames: string[] = [];
  for (const item of action.items) {
    const itemName = typeof item === 'string' ? item : item.name;
    const qty = typeof item === 'object' && typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : null;
    await tx('INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)', [generateUuid(), action.bin_id, itemName, qty, nextPos++]);
    itemNames.push(itemName);
  }
  await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { items_added: { old: null, new: itemNames } },
  });
  return { type: 'add_items', success: true, details: `Added ${action.items.length} item(s) to ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleRemoveItems(action: Extract<CommandAction, { type: 'remove_items' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>('SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  for (const itemName of action.items) {
    await tx('DELETE FROM bin_items WHERE bin_id = $1 AND LOWER(name) = LOWER($2)', [action.bin_id, itemName]);
  }
  await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { items_removed: { old: action.items, new: null } },
  });
  return { type: 'remove_items', success: true, details: `Removed ${action.items.length} item(s) from ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleModifyItem(action: Extract<CommandAction, { type: 'modify_item' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>('SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  await tx(`UPDATE bin_items SET name = $1, updated_at = ${d.now()} WHERE bin_id = $2 AND LOWER(name) = LOWER($3)`, [action.new_item, action.bin_id, action.old_item]);
  await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { items_renamed: { old: action.old_item, new: action.new_item } },
  });
  return { type: 'modify_item', success: true, details: `Renamed "${action.old_item}" to "${action.new_item}" in ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleReorderItems(action: Extract<CommandAction, { type: 'reorder_items' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; visibility: string; created_by: string }>('SELECT id, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  // Verify all item IDs belong to this bin
  const existing = await tx<{ id: string }>('SELECT id FROM bin_items WHERE bin_id = $1', [action.bin_id]);
  const binItemIds = new Set(existing.rows.map((r) => r.id));
  for (const itemId of action.item_ids) {
    if (!binItemIds.has(itemId)) throw new Error('One or more item IDs do not belong to this bin');
  }
  for (let i = 0; i < action.item_ids.length; i++) {
    await tx('UPDATE bin_items SET position = $1 WHERE id = $2 AND bin_id = $3', [i, action.item_ids[i], action.bin_id]);
  }
  await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { items_reordered: { old: null, new: action.item_ids } },
  });
  return { type: 'reorder_items', success: true, details: `Reordered items in "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}
