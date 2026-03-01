import crypto from 'node:crypto';
import { generateUuid, getDb, querySync } from '../db.js';
import { logActivity } from './activityLog.js';
import type { CommandAction } from './commandParser.js';
import { generateShortCode } from './shortCode.js';

export interface ActionResult {
  type: string;
  success: boolean;
  details: string;
  bin_id?: string;
  bin_name?: string;
  error?: string;
}

export interface ExecuteResult {
  executed: ActionResult[];
  errors: string[];
}

interface PendingActivity {
  locationId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  authMethod?: 'jwt' | 'api_key';
  apiKeyId?: string;
}

const MAX_ACTIONS = 50;
const MAX_ITEMS_PER_ACTION = 500;

export async function executeActions(
  actions: CommandAction[],
  locationId: string,
  userId: string,
  userName: string,
  authMethod?: 'jwt' | 'api_key',
  apiKeyId?: string,
): Promise<ExecuteResult> {
  if (actions.length > MAX_ACTIONS) {
    throw new Error(`Too many actions (${actions.length}). Maximum is ${MAX_ACTIONS}.`);
  }

  const executed: ActionResult[] = [];
  const errors: string[] = [];
  const pendingActivities: PendingActivity[] = [];

  const db = getDb();
  const transaction = db.transaction(() => {
    for (const action of actions) {
      try {
        const result = executeSingleAction(action, locationId, userId, userName, pendingActivities, authMethod, apiKeyId);
        executed.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${action.type}: ${msg}`);
        executed.push({
          type: action.type,
          success: false,
          details: msg,
          error: msg,
        });
      }
    }
  });

  transaction();

  // Fire-and-forget activity log entries after transaction commits
  for (const activity of pendingActivities) {
    logActivity(activity);
  }

  return { executed, errors };
}

function executeSingleAction(
  action: CommandAction,
  locationId: string,
  userId: string,
  userName: string,
  pendingActivities: PendingActivity[],
  authMethod?: 'jwt' | 'api_key',
  apiKeyId?: string,
): ActionResult {
  switch (action.type) {
    case 'add_items': {
      if (action.items.length > MAX_ITEMS_PER_ACTION) throw new Error('Too many items per action (max 500)');
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const maxResult = querySync<{ max_pos: number | null }>('SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1', [action.bin_id]);
      let nextPos = (maxResult.rows[0]?.max_pos ?? -1) + 1;
      for (const itemName of action.items) {
        querySync('INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)', [generateUuid(), action.bin_id, itemName, nextPos++]);
      }
      querySync("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items_added: { old: null, new: action.items } },
      });
      return { type: 'add_items', success: true, details: `Added ${action.items.length} item(s) to ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'remove_items': {
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      for (const itemName of action.items) {
        querySync('DELETE FROM bin_items WHERE bin_id = $1 AND LOWER(name) = LOWER($2)', [action.bin_id, itemName]);
      }
      querySync("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items_removed: { old: action.items, new: null } },
      });
      return { type: 'remove_items', success: true, details: `Removed ${action.items.length} item(s) from ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'modify_item': {
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync("UPDATE bin_items SET name = $1, updated_at = datetime('now') WHERE bin_id = $2 AND LOWER(name) = LOWER($3)", [action.new_item, action.bin_id, action.old_item]);
      querySync("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items_renamed: { old: action.old_item, new: action.new_item } },
      });
      return { type: 'modify_item', success: true, details: `Renamed "${action.old_item}" to "${action.new_item}" in ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'create_bin': {
      let areaId: string | null = null;

      // Resolve area by name if provided
      if (action.area_name) {
        const area = querySync(
          'SELECT id FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)',
          [locationId, action.area_name]
        );
        if (area.rows.length > 0) {
          areaId = area.rows[0].id as string;
        } else {
          // Create the area
          const newAreaId = generateUuid();
          querySync(
            'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
            [newAreaId, locationId, action.area_name, userId]
          );
          areaId = newAreaId;
          pendingActivities.push({
            locationId, userId, userName, authMethod, apiKeyId,
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
          querySync(
            `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [code, locationId, action.name, areaId, action.notes || '', action.tags || [], action.icon || '', action.color || '', action.card_style || '', userId]
          );
          binId = code;
          break;
        } catch (err: unknown) {
          const sqliteErr = err as { code?: string };
          if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < maxRetries) continue;
          throw err;
        }
      }

      // Insert items into bin_items
      const createItems: string[] = action.items || [];
      if (createItems.length > MAX_ITEMS_PER_ACTION) throw new Error('Too many items per action (max 500)');
      for (let i = 0; i < createItems.length; i++) {
        querySync('INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), binId, createItems[i], i]);
      }

      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'create', entityType: 'bin', entityId: binId, entityName: action.name,
      });
      return { type: 'create_bin', success: true, details: `Created bin "${action.name}"`, bin_id: binId, bin_name: action.name };
    }

    case 'delete_bin': {
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync("UPDATE bins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'delete', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
      });
      return { type: 'delete_bin', success: true, details: `Deleted bin "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'add_tags': {
      const bin = querySync('SELECT id, name, tags FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].tags || [];
      const merged = [...new Set([...current, ...action.tags])];
      querySync("UPDATE bins SET tags = $1, updated_at = datetime('now') WHERE id = $2", [merged, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { tags: { old: current, new: merged } },
      });
      return { type: 'add_tags', success: true, details: `Added tags [${action.tags.join(', ')}] to ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'remove_tags': {
      const bin = querySync('SELECT id, name, tags FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].tags || [];
      const removeSet = new Set(action.tags.map((t) => t.toLowerCase()));
      const filtered = current.filter((t) => !removeSet.has(t.toLowerCase()));
      querySync("UPDATE bins SET tags = $1, updated_at = datetime('now') WHERE id = $2", [filtered, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { tags: { old: current, new: filtered } },
      });
      return { type: 'remove_tags', success: true, details: `Removed tags [${action.tags.join(', ')}] from ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'modify_tag': {
      const bin = querySync('SELECT id, name, tags FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].tags || [];
      const modified = current.map((t) => t.toLowerCase() === action.old_tag.toLowerCase() ? action.new_tag : t);
      querySync("UPDATE bins SET tags = $1, updated_at = datetime('now') WHERE id = $2", [modified, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { tags: { old: current, new: modified } },
      });
      return { type: 'modify_tag', success: true, details: `Renamed tag "${action.old_tag}" to "${action.new_tag}" in ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'set_area': {
      const bin = querySync('SELECT id, name, area_id FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      let areaId = action.area_id;

      // If area_id is null but area_name provided, look up or create
      if (!areaId && action.area_name) {
        const area = querySync(
          'SELECT id FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)',
          [locationId, action.area_name]
        );
        if (area.rows.length > 0) {
          areaId = area.rows[0].id as string;
        } else {
          const newAreaId = generateUuid();
          querySync(
            'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
            [newAreaId, locationId, action.area_name, userId]
          );
          areaId = newAreaId;
          pendingActivities.push({
            locationId, userId, userName, authMethod, apiKeyId,
            action: 'create', entityType: 'area', entityId: newAreaId, entityName: action.area_name,
          });
        }
      }

      querySync("UPDATE bins SET area_id = $1, updated_at = datetime('now') WHERE id = $2", [areaId, action.bin_id]);
      // Resolve old area name for activity log
      const oldAreaId = bin.rows[0].area_id as string | null;
      let oldAreaName = '';
      if (oldAreaId) {
        const oldArea = querySync<{ name: string }>('SELECT name FROM areas WHERE id = $1', [oldAreaId]);
        oldAreaName = oldArea.rows[0]?.name ?? '';
      }
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { area: { old: oldAreaName || null, new: action.area_name || null } },
      });
      return { type: 'set_area', success: true, details: `Set area of ${action.bin_name} to "${action.area_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'set_notes': {
      const bin = querySync('SELECT id, name, notes FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
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
      querySync("UPDATE bins SET notes = $1, updated_at = datetime('now') WHERE id = $2", [newNotes, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { notes: { old: oldNotes, new: newNotes } },
      });
      return { type: 'set_notes', success: true, details: `${action.mode === 'clear' ? 'Cleared' : 'Updated'} notes on ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'set_icon': {
      const bin = querySync('SELECT id, name, icon FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync("UPDATE bins SET icon = $1, updated_at = datetime('now') WHERE id = $2", [action.icon, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { icon: { old: bin.rows[0].icon, new: action.icon } },
      });
      return { type: 'set_icon', success: true, details: `Set icon of ${action.bin_name} to ${action.icon}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'set_color': {
      const bin = querySync('SELECT id, name, color FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync("UPDATE bins SET color = $1, updated_at = datetime('now') WHERE id = $2", [action.color, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { color: { old: bin.rows[0].color, new: action.color } },
      });
      return { type: 'set_color', success: true, details: `Set color of ${action.bin_name} to ${action.color}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'update_bin': {
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
            [locationId, action.area_name]
          );
          if (area.rows.length > 0) {
            areaId = area.rows[0].id as string;
          } else {
            const newAreaId = generateUuid();
            querySync(
              'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
              [newAreaId, locationId, action.area_name, userId]
            );
            areaId = newAreaId;
            pendingActivities.push({
              locationId, userId, userName, authMethod, apiKeyId,
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
        updates.push(`updated_at = datetime('now')`);
        params.push(action.bin_id);
        querySync(`UPDATE bins SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
      }

      if (Object.keys(changes).length > 0) {
        pendingActivities.push({
          locationId, userId, userName, authMethod, apiKeyId,
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

    case 'restore_bin': {
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NOT NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found in trash: ${action.bin_name}`);
      querySync("UPDATE bins SET deleted_at = NULL, updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'restore', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
      });
      return { type: 'restore_bin', success: true, details: `Restored bin "${action.bin_name}" from trash`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'duplicate_bin': {
      const src = querySync<{ id: string; name: string; area_id: string | null; notes: string; tags: string[]; icon: string; color: string; card_style: string; visibility: string }>(
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
          querySync(
            `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, visibility, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [code, locationId, newName, s.area_id, s.notes, s.tags, s.icon, s.color, s.card_style, s.visibility, userId]
          );
          binId = code;
          break;
        } catch (err: unknown) {
          const sqliteErr = err as { code?: string };
          if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < maxRetries) continue;
          throw err;
        }
      }

      // Copy items
      const srcItems = querySync<{ name: string }>('SELECT name FROM bin_items WHERE bin_id = $1 ORDER BY position', [action.bin_id]);
      for (let i = 0; i < srcItems.rows.length; i++) {
        querySync('INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)', [generateUuid(), binId, srcItems.rows[i].name, i]);
      }

      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'duplicate', entityType: 'bin', entityId: binId, entityName: newName,
      });
      return { type: 'duplicate_bin', success: true, details: `Duplicated "${action.bin_name}" as "${newName}"`, bin_id: binId, bin_name: newName };
    }

    case 'pin_bin': {
      const bin = querySync('SELECT id FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync(
        'INSERT OR IGNORE INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position),0)+1 FROM pinned_bins WHERE user_id = $1))',
        [userId, action.bin_id]
      );
      return { type: 'pin_bin', success: true, details: `Pinned "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'unpin_bin': {
      querySync('DELETE FROM pinned_bins WHERE user_id = $1 AND bin_id = $2', [userId, action.bin_id]);
      return { type: 'unpin_bin', success: true, details: `Unpinned "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'rename_area': {
      const area = querySync('SELECT id, name FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, locationId]);
      if (area.rows.length === 0) throw new Error(`Area not found: ${action.area_name}`);
      const oldName = area.rows[0].name as string;
      querySync("UPDATE areas SET name = $1, updated_at = datetime('now') WHERE id = $2 AND location_id = $3", [action.new_name, action.area_id, locationId]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'area', entityId: action.area_id, entityName: action.new_name,
        changes: { name: { old: oldName, new: action.new_name } },
      });
      return { type: 'rename_area', success: true, details: `Renamed area "${oldName}" to "${action.new_name}"` };
    }

    case 'delete_area': {
      const area = querySync('SELECT id, name FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, locationId]);
      if (area.rows.length === 0) throw new Error(`Area not found: ${action.area_name}`);
      querySync('UPDATE bins SET area_id = NULL WHERE area_id = $1', [action.area_id]);
      querySync('DELETE FROM areas WHERE id = $1 AND location_id = $2', [action.area_id, locationId]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'delete', entityType: 'area', entityId: action.area_id, entityName: action.area_name,
      });
      return { type: 'delete_area', success: true, details: `Deleted area "${action.area_name}"` };
    }

    case 'set_tag_color': {
      const tcId = generateUuid();
      querySync(
        `INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, tag) DO UPDATE SET color = $4, updated_at = datetime('now')`,
        [tcId, locationId, action.tag, action.color]
      );
      return { type: 'set_tag_color', success: true, details: `Set color of tag "${action.tag}" to ${action.color}` };
    }

    case 'reorder_items': {
      const bin = querySync('SELECT id FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      for (let i = 0; i < action.item_ids.length; i++) {
        querySync('UPDATE bin_items SET position = $1 WHERE id = $2 AND bin_id = $3', [i, action.item_ids[i], action.bin_id]);
      }
      querySync("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName, authMethod, apiKeyId,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items_reordered: { old: null, new: action.item_ids } },
      });
      return { type: 'reorder_items', success: true, details: `Reordered items in "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    default:
      return { type: (action as { type: string }).type, success: false, details: 'Unknown action type', error: 'Unknown action type' };
  }
}
