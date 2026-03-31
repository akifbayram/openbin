import { d, generateUuid, querySync } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import type { ActionContext } from './types.js';

export function handleSetArea(action: Extract<CommandAction, { type: 'set_area' }>, ctx: ActionContext): ActionResult {
  const bin = querySync('SELECT id, name, area_id FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  let areaId = action.area_id;

  // If area_id is null but area_name provided, look up or create
  if (!areaId && action.area_name) {
    const area = querySync(
      'SELECT id FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)',
      [ctx.locationId, action.area_name]
    );
    if (area.rows.length > 0) {
      areaId = area.rows[0].id as string;
    } else {
      const newAreaId = generateUuid();
      querySync(
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

  querySync(`UPDATE bins SET area_id = $1, updated_at = ${d.now()} WHERE id = $2`, [areaId, action.bin_id]);
  // Resolve old area name for activity log
  const oldAreaId = bin.rows[0].area_id as string | null;
  let oldAreaName = '';
  if (oldAreaId) {
    const oldArea = querySync<{ name: string }>('SELECT name FROM areas WHERE id = $1', [oldAreaId]);
    oldAreaName = oldArea.rows[0]?.name ?? '';
  }
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
    changes: { area: { old: oldAreaName || null, new: action.area_name || null } },
  });
  return { type: 'set_area', success: true, details: `Set area of ${action.bin_name} to "${action.area_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export function handleRenameArea(action: Extract<CommandAction, { type: 'rename_area' }>, ctx: ActionContext): ActionResult {
  const area = querySync('SELECT id, name FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, ctx.locationId]);
  if (area.rows.length === 0) throw new Error(`Area not found: ${action.area_name}`);
  const oldName = area.rows[0].name as string;
  querySync(`UPDATE areas SET name = $1, updated_at = ${d.now()} WHERE id = $2 AND location_id = $3`, [action.new_name, action.area_id, ctx.locationId]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'update', entityType: 'area', entityId: action.area_id, entityName: action.new_name,
    changes: { name: { old: oldName, new: action.new_name } },
  });
  return { type: 'rename_area', success: true, details: `Renamed area "${oldName}" to "${action.new_name}"` };
}

export function handleDeleteArea(action: Extract<CommandAction, { type: 'delete_area' }>, ctx: ActionContext): ActionResult {
  const area = querySync('SELECT id, name FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, ctx.locationId]);
  if (area.rows.length === 0) throw new Error(`Area not found: ${action.area_name}`);
  querySync('UPDATE bins SET area_id = NULL WHERE area_id = $1', [action.area_id]);
  querySync('DELETE FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, ctx.locationId]);
  ctx.pendingActivities.push({
    locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
    action: 'delete', entityType: 'area', entityId: action.area_id, entityName: action.area_name,
  });
  return { type: 'delete_area', success: true, details: `Deleted area "${action.area_name}"` };
}
