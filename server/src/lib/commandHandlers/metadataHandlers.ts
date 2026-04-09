import type { TxQueryFn } from '../../db.js';
import { d } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { type ActionContext, assertBinVisible } from './types.js';

export async function handleSetNotes(action: Extract<CommandAction, { type: 'set_notes' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; notes: string; visibility: string; created_by: string }>('SELECT id, name, notes, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  const oldNotes = (bin.rows[0].notes as string) || '';
  let newNotes: string;
  switch (action.mode) {
    case 'append':
      newNotes = oldNotes ? `${oldNotes}\n${action.notes}` : action.notes;
      break;
    case 'clear':
      newNotes = '';
      break;
    default:
      newNotes = action.notes;
  }
  await tx(`UPDATE bins SET notes = $1, updated_at = ${d.now()} WHERE id = $2`, [newNotes, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { notes: { old: oldNotes, new: newNotes } },
  });
  return { type: 'set_notes', success: true, details: `${action.mode === 'clear' ? 'Cleared' : 'Updated'} notes on ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleSetIcon(action: Extract<CommandAction, { type: 'set_icon' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; icon: string; visibility: string; created_by: string }>('SELECT id, name, icon, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  await tx(`UPDATE bins SET icon = $1, updated_at = ${d.now()} WHERE id = $2`, [action.icon, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { icon: { old: bin.rows[0].icon, new: action.icon } },
  });
  return { type: 'set_icon', success: true, details: `Set icon of ${action.bin_name} to ${action.icon}`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export async function handleSetColor(action: Extract<CommandAction, { type: 'set_color' }>, ctx: ActionContext, tx: TxQueryFn): Promise<ActionResult> {
  const bin = await tx<{ id: string; name: string; color: string; visibility: string; created_by: string }>('SELECT id, name, color, visibility, created_by FROM bins WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL', [action.bin_id, ctx.locationId]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  assertBinVisible(bin.rows[0], ctx.userId);
  await tx(`UPDATE bins SET color = $1, updated_at = ${d.now()} WHERE id = $2`, [action.color, action.bin_id]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { color: { old: bin.rows[0].color, new: action.color } },
  });
  return { type: 'set_color', success: true, details: `Set color of ${action.bin_name} to ${action.color}`, bin_id: action.bin_id, bin_name: action.bin_name };
}
