import { d, generateUuid, querySync } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import { replaceCustomFieldValuesSync } from '../customFieldHelpers.js';
import type { ActionContext } from './types.js';

export function handleUpdateBin(action: Extract<CommandAction, { type: 'update_bin' }>, ctx: ActionContext): ActionResult {
  const bin = querySync<{ id: string; name: string; notes: string; tags: string[]; area_id: string | null; icon: string; color: string; card_style: string; visibility: string }>(
    'SELECT id, name, notes, tags, area_id, icon, color, card_style, visibility FROM bins WHERE id = $1 AND deleted_at IS NULL',
    [action.bin_id]
  );
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  const old = bin.rows[0];

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (action.name !== undefined && action.name !== old.name) {
    updates.push(`name = $${paramIdx++}`);
    params.push(action.name);
    changes.name = { old: old.name, new: action.name };
  }
  if (action.notes !== undefined && action.notes !== old.notes) {
    updates.push(`notes = $${paramIdx++}`);
    params.push(action.notes);
    changes.notes = { old: old.notes, new: action.notes };
  }
  if (action.tags !== undefined) {
    updates.push(`tags = $${paramIdx++}`);
    params.push(action.tags);
    changes.tags = { old: old.tags, new: action.tags };
  }
  if (action.icon !== undefined && action.icon !== old.icon) {
    updates.push(`icon = $${paramIdx++}`);
    params.push(action.icon);
    changes.icon = { old: old.icon, new: action.icon };
  }
  if (action.color !== undefined && action.color !== old.color) {
    updates.push(`color = $${paramIdx++}`);
    params.push(action.color);
    changes.color = { old: old.color, new: action.color };
  }
  if (action.card_style !== undefined && action.card_style !== old.card_style) {
    updates.push(`card_style = $${paramIdx++}`);
    params.push(action.card_style);
    changes.card_style = { old: old.card_style, new: action.card_style };
  }
  if (action.visibility !== undefined && action.visibility !== old.visibility) {
    updates.push(`visibility = $${paramIdx++}`);
    params.push(action.visibility);
    changes.visibility = { old: old.visibility, new: action.visibility };
  }

  // Resolve area by name
  if (action.area_name !== undefined) {
    let areaId: string | null = null;
    if (action.area_name) {
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
    if (areaId !== old.area_id) {
      updates.push(`area_id = $${paramIdx++}`);
      params.push(areaId);
      // Resolve old area name for change tracking
      let oldAreaName = '';
      if (old.area_id) {
        const oldArea = querySync<{ name: string }>('SELECT name FROM areas WHERE id = $1', [old.area_id]);
        oldAreaName = oldArea.rows[0]?.name ?? '';
      }
      changes.area = { old: oldAreaName || null, new: action.area_name || null };
    }
  }

  if (updates.length > 0) {
    updates.push(`updated_at = ${d.now()}`);
    params.push(action.bin_id);
    querySync(`UPDATE bins SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
  }

  // Handle custom fields
  if (action.custom_fields && typeof action.custom_fields === 'object') {
    replaceCustomFieldValuesSync(action.bin_id, action.custom_fields as Record<string, string>, ctx.locationId);
  }

  if (Object.keys(changes).length > 0) {
    ctx.pendingActivities.push({
      locationId: ctx.locationId, userId: ctx.userId, userName: ctx.userName, authMethod: ctx.authMethod, apiKeyId: ctx.apiKeyId,
      action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.name || action.bin_name,
      changes,
    });
  }

  const changedFields = Object.keys(changes);
  const detail = changedFields.length > 0
    ? `Updated ${action.bin_name}: ${changedFields.join(', ')}`
    : `No changes to ${action.bin_name}`;
  return { type: 'update_bin', success: true, details: detail, bin_id: action.bin_id, bin_name: action.bin_name };
}
