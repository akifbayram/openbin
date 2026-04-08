import type { TxQueryFn } from '../../db.js';
import { d, generateUuid, isUniqueViolation } from '../../db.js';
import { requireAdmin } from '../binAccess.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { replaceCustomFieldValues } from '../customFieldHelpers.js';
import { assertBinCreationAllowedTx } from '../planGate.js';
import { generateShortCode } from '../shortCode.js';
import { type ActionContext, assertBinVisible } from './types.js';

const MAX_ITEMS_PER_ACTION = 500;

export async function handleCreateBin(action: Extract<CommandAction, { type: 'create_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  await assertBinCreationAllowedTx(ctx.userId, tx);

  let areaId: string | null = null;

  // Resolve area by name if provided
  if (action.area_name) {
    const area = await tx(
      'SELECT id FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)',
      [ctx.locationId, action.area_name]
    );
    if (area.rows.length > 0) {
      areaId = area.rows[0].id as string;
    } else {
      // Create the area
      const newAreaId = generateUuid();
      await tx(
        'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
        [newAreaId, ctx.locationId, action.area_name, ctx.userId]
      );
      areaId = newAreaId;
      ctx.pendingActivities.push({
        locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
        action: 'create', entityType: 'area', entityId: newAreaId, entityName: action.area_name,
      });
    }
  }

  // Generate UUID for ID and short code with retry
  const binId = generateUuid();
  let shortCode = generateShortCode(action.name);
  const maxRetries = 10;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = attempt === 0 ? shortCode : generateShortCode(action.name);
    try {
      await tx(
        `INSERT INTO bins (id, short_code, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [binId, code, ctx.locationId, action.name, areaId, action.notes || '', action.tags || [], action.icon || '', action.color || '', action.card_style || '', ctx.userId]
      );
      shortCode = code;
      break;
    } catch (err: unknown) {
      if (isUniqueViolation(err) && attempt < maxRetries) continue;
      throw err;
    }
  }

  // Insert items into bin_items
  const createItems = action.items || [];
  if (createItems.length > MAX_ITEMS_PER_ACTION) throw new Error('Too many items per action (max 500)');
  for (let i = 0; i < createItems.length; i++) {
    const item = createItems[i];
    const itemName = typeof item === 'string' ? item : item.name;
    const qty = typeof item === 'object' && typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : null;
    await tx('INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)', [generateUuid(), binId, itemName, qty, i]);
  }

  // Insert custom field values
  if (action.custom_fields && typeof action.custom_fields === 'object') {
    await replaceCustomFieldValues(binId, action.custom_fields as Record<string, string>, ctx.locationId, tx);
  }

  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'create', entityType: 'bin', entityId: binId, entityName: action.name,
  });
  return { type: 'create_bin', success: true, details: `Created bin "${action.name}"`, bin_id: binId, bin_name: action.name };
}

export async function handleDeleteBin(action: Extract<CommandAction, { type: 'delete_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  await requireAdmin(ctx.locationId, ctx.userId, 'delete bins');
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>('SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  await tx(`UPDATE bins SET deleted_at = ${d.now()}, updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'delete', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
  });
  return { type: 'delete_bin', success: true, details: `Deleted bin "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleRestoreBin(action: Extract<CommandAction, { type: 'restore_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  await requireAdmin(ctx.locationId, ctx.userId, 'restore bins');
  await assertBinCreationAllowedTx(ctx.userId, tx);
  const bin = await tx<{ id: string; name: string; visibility: string; created_by: string }>('SELECT id, name, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NOT NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found in trash: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  await tx(`UPDATE bins SET deleted_at = NULL, updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'restore', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
  });
  return { type: 'restore_bin', success: true, details: `Restored bin "${action.bin_name}" from trash`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleDuplicateBin(action: Extract<CommandAction, { type: 'duplicate_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  await assertBinCreationAllowedTx(ctx.userId, tx);

  const src = await tx<{ id: string; name: string; area_id: string | null; notes: string; tags: string[]; icon: string; color: string; card_style: string; visibility: string; created_by: string }>(
    'SELECT id, name, area_id, notes, tags, icon, color, card_style, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL',
    [action.bin_id, ctx.locationId]
  );
  if (src.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(src.rows[0], ctx.userId);
  const s = src.rows[0];
  const newName = action.new_name || `Copy of ${s.name}`;

  const binId = generateUuid();
  let shortCode = generateShortCode(newName);
  const maxRetries = 10;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = attempt === 0 ? shortCode : generateShortCode(newName);
    try {
      await tx(
        `INSERT INTO bins (id, short_code, location_id, name, area_id, notes, tags, icon, color, card_style, visibility, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [binId, code, ctx.locationId, newName, s.area_id, s.notes, s.tags, s.icon, s.color, s.card_style, s.visibility, ctx.userId]
      );
      shortCode = code;
      break;
    } catch (err: unknown) {
      if (isUniqueViolation(err) && attempt < maxRetries) continue;
      throw err;
    }
  }

  // Copy items
  const srcItems = await tx<{ name: string; quantity: number | null }>('SELECT name, quantity FROM bin_items WHERE bin_id = $1 ORDER BY position', [action.bin_id]);
  for (let i = 0; i < srcItems.rows.length; i++) {
    await tx('INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)', [generateUuid(), binId, srcItems.rows[i].name, srcItems.rows[i].quantity, i]);
  }

  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'duplicate', entityType: 'bin', entityId: binId, entityName: newName,
  });
  return { type: 'duplicate_bin', success: true, details: `Duplicated "${action.bin_name}" as "${newName}"`, bin_id: binId, bin_name: newName };
}
