import crypto from 'node:crypto';
import type { TxQueryFn } from '../../db.js';
import { d, generateUuid } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { replaceCustomFieldValues } from '../customFieldHelpers.js';
import { generateShortCode } from '../shortCode.js';
import type { ActionContext } from './types.js';

const MAX_ITEMS_PER_ACTION = 500;

export async function handleCreateBin(action: Extract<CommandAction, { type: 'create_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
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

  // Generate short code as ID with retry
  let binId = generateShortCode(action.name);
  const maxRetries = 10;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = attempt === 0 ? binId : generateShortCode(action.name);
    try {
      await tx(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [code, ctx.locationId, action.name, areaId, action.notes || '', action.tags || [], action.icon || '', action.color || '', action.card_style || '', ctx.userId]
      );
      binId = code;
      break;
    } catch (err: unknown) {
      const errObj = err as { code?: string };
      if ((errObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errObj.code === '23505') && attempt < maxRetries) continue;
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
    await tx('INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)', [crypto.randomUUID(), binId, itemName, qty, i]);
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
  const bin = await tx('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  await tx(`UPDATE bins SET deleted_at = ${d.now()}, updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'delete', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
  });
  return { type: 'delete_bin', success: true, details: `Deleted bin "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleRestoreBin(action: Extract<CommandAction, { type: 'restore_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NOT NULL', [action.bin_id]);
  if (bin.rows.length === 0) throw new Error(`Bin not found in trash: ${action.bin_name}`);
  await tx(`UPDATE bins SET deleted_at = NULL, updated_at = ${d.now()} WHERE id = $1`, [action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'restore', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
  });
  return { type: 'restore_bin', success: true, details: `Restored bin "${action.bin_name}" from trash`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleDuplicateBin(action: Extract<CommandAction, { type: 'duplicate_bin' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const src = await tx<{ id: string; name: string; area_id: string | null; notes: string; tags: string[]; icon: string; color: string; card_style: string; visibility: string }>(
    'SELECT id, name, area_id, notes, tags, icon, color, card_style, visibility FROM bins WHERE id = $1 AND deleted_at IS NULL',
    [action.bin_id]
  );
  if (src.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  const s = src.rows[0];
  const newName = action.new_name || `Copy of ${s.name}`;

  let binId = generateShortCode(newName);
  const maxRetries = 10;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = attempt === 0 ? binId : generateShortCode(newName);
    try {
      await tx(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, visibility, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [code, ctx.locationId, newName, s.area_id, s.notes, s.tags, s.icon, s.color, s.card_style, s.visibility, ctx.userId]
      );
      binId = code;
      break;
    } catch (err: unknown) {
      const errObj = err as { code?: string };
      if ((errObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errObj.code === '23505') && attempt < maxRetries) continue;
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
