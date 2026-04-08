import type { TxQueryFn } from '../../db.js';
import { d, generateUuid } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { type ActionContext, assertBinVisible } from './types.js';

export async function handleAddTags(action: Extract<CommandAction, { type: 'add_tags' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; tags: string[]; visibility: string; created_by: string }>('SELECT id, name, tags, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  const current: string[] = bin.rows[0].tags || [];
  const merged = [...new Set([...current, ...action.tags])];
  await tx(`UPDATE bins SET tags = $1, updated_at = ${d.now()} WHERE id = $2`, [merged, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { tags: { old: current, new: merged } },
  });
  return { type: 'add_tags', success: true, details: `Added tags [${action.tags.join(', ')}] to ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleRemoveTags(action: Extract<CommandAction, { type: 'remove_tags' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; tags: string[]; visibility: string; created_by: string }>('SELECT id, name, tags, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  const current: string[] = bin.rows[0].tags || [];
  const removeSet = new Set(action.tags.map((t) => t.toLowerCase()));
  const filtered = current.filter((t) => !removeSet.has(t.toLowerCase()));
  await tx(`UPDATE bins SET tags = $1, updated_at = ${d.now()} WHERE id = $2`, [filtered, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { tags: { old: current, new: filtered } },
  });
  return { type: 'remove_tags', success: true, details: `Removed tags [${action.tags.join(', ')}] from ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleModifyTag(action: Extract<CommandAction, { type: 'modify_tag' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; tags: string[]; visibility: string; created_by: string }>('SELECT id, name, tags, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  const current: string[] = bin.rows[0].tags || [];
  const modified = current.map((t) => t.toLowerCase() === action.old_tag.toLowerCase() ? action.new_tag : t);
  await tx(`UPDATE bins SET tags = $1, updated_at = ${d.now()} WHERE id = $2`, [modified, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { tags: { old: current, new: modified } },
  });
  return { type: 'modify_tag', success: true, details: `Renamed tag "${action.old_tag}" to "${action.new_tag}" in ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleSetTagColor(action: Extract<CommandAction, { type: 'set_tag_color' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const tcId = generateUuid();
  await tx(
    `INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)
     ON CONFLICT (location_id, tag) DO UPDATE SET color = $4, updated_at = ${d.now()}`,
    [tcId, ctx.locationId, action.tag, action.color]
  );
  return { type: 'set_tag_color', success: true, details: `Set color of tag "${action.tag}" to ${action.color}` };
}
