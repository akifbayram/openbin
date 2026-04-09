import type { TxQueryFn } from '../../db.js';
import { d, generateUuid } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { type ActionContext, assertBinVisible } from './types.js';

export async function handleCheckoutItem(action: Extract<CommandAction, { type: 'checkout_item' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>(
    'SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL',
    [action.bin_id, ctx.locationId],
  );
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);

  const item = await tx<{ id: string; name: string }>(
    'SELECT id, name FROM bin_items WHERE bin_id = $1 AND LOWER(name) = LOWER($2)',
    [action.bin_id, action.item_name],
  );
  if (item.rows.length === 0) throw new Error(`Item not found: ${action.item_name}`);

  const itemRow = item.rows[0];

  const existing = await tx(
    'SELECT id FROM item_checkouts WHERE item_id = $1 AND returned_at IS NULL',
    [itemRow.id],
  );
  if (existing.rows.length > 0) throw new Error(`Item "${itemRow.name}" is already checked out`);

  const checkoutId = generateUuid();
  await tx(
    `INSERT INTO item_checkouts (id, item_id, origin_bin_id, location_id, checked_out_by, checked_out_at)
     VALUES ($1, $2, $3, $4, $5, ${d.now()})`,
    [checkoutId, itemRow.id, action.bin_id, ctx.locationId, ctx.userId],
  );
  await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);

  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { item_checked_out: { old: null, new: itemRow.name } },
  });

  return { type: 'checkout_item', success: true, details: `Checked out "${itemRow.name}" from "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleReturnItem(action: Extract<CommandAction, { type: 'return_item' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>(
    'SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL',
    [action.bin_id, ctx.locationId],
  );
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);

  const item = await tx<{ id: string; name: string }>(
    'SELECT id, name FROM bin_items WHERE bin_id = $1 AND LOWER(name) = LOWER($2)',
    [action.bin_id, action.item_name],
  );
  if (item.rows.length === 0) throw new Error(`Item not found: ${action.item_name}`);

  const itemRow = item.rows[0];

  const checkout = await tx<{ id: string; origin_bin_id: string }>(
    'SELECT id, origin_bin_id FROM item_checkouts WHERE item_id = $1 AND returned_at IS NULL',
    [itemRow.id],
  );
  if (checkout.rows.length === 0) throw new Error(`Item "${itemRow.name}" is not checked out`);

  const returnBinId = action.target_bin_id ?? checkout.rows[0].origin_bin_id;

  await tx(
    `UPDATE item_checkouts SET returned_at = ${d.now()}, returned_by = $1, return_bin_id = $2 WHERE id = $3`,
    [ctx.userId, returnBinId, checkout.rows[0].id],
  );

  if (returnBinId !== checkout.rows[0].origin_bin_id) {
    const targetBin = await tx<{ id: string; name: string }>(
      'SELECT id, name FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL',
      [returnBinId, ctx.locationId],
    );
    if (targetBin.rows.length === 0) throw new Error(`Target bin not found: ${action.target_bin_name ?? returnBinId}`);

    const maxResult = await tx<{ max_pos: number | null }>(
      'SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1',
      [returnBinId],
    );
    const nextPos = (maxResult.rows[0]?.max_pos ?? -1) + 1;
    await tx('UPDATE bin_items SET bin_id = $1, position = $2 WHERE id = $3', [returnBinId, nextPos, itemRow.id]);
    await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id IN ($1, $2)`, [checkout.rows[0].origin_bin_id, returnBinId]);

    ctx.pendingActivities.push({
      locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
      action: 'update', entityType: 'bin', entityId: checkout.rows[0].origin_bin_id, entityName: action.bin_name,
      changes: { item_returned_to: { old: null, new: targetBin.rows[0].name } },
    });
    ctx.pendingActivities.push({
      locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
      action: 'update', entityType: 'bin', entityId: returnBinId, entityName: targetBin.rows[0].name,
      changes: { item_received: { old: null, new: itemRow.name } },
    });
  } else {
    await tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
    ctx.pendingActivities.push({
      locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
      action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
      changes: { item_returned: { old: null, new: itemRow.name } },
    });
  }

  return { type: 'return_item', success: true, details: `Returned "${itemRow.name}" to "${action.target_bin_name ?? action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}
