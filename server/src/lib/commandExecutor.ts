import { getDb } from '../db.js';
import { querySync, generateUuid } from '../db.js';
import { logActivity, computeChanges } from './activityLog.js';
import { generateShortCode } from './shortCode.js';
import type { CommandAction } from './commandParser.js';

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
}

export async function executeActions(
  actions: CommandAction[],
  locationId: string,
  userId: string,
  userName: string
): Promise<ExecuteResult> {
  const executed: ActionResult[] = [];
  const errors: string[] = [];
  const pendingActivities: PendingActivity[] = [];

  const db = getDb();
  const transaction = db.transaction(() => {
    for (const action of actions) {
      try {
        const result = executeSingleAction(action, locationId, userId, userName, pendingActivities);
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
  pendingActivities: PendingActivity[]
): ActionResult {
  switch (action.type) {
    case 'add_items': {
      const bin = querySync('SELECT id, name, items FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].items || [];
      const merged = [...current, ...action.items];
      querySync("UPDATE bins SET items = $1, updated_at = datetime('now') WHERE id = $2", [merged, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items: { old: current, new: merged } },
      });
      return { type: 'add_items', success: true, details: `Added ${action.items.length} item(s) to ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'remove_items': {
      const bin = querySync('SELECT id, name, items FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].items || [];
      const removeSet = new Set(action.items.map((i) => i.toLowerCase()));
      const filtered = current.filter((i) => !removeSet.has(i.toLowerCase()));
      querySync("UPDATE bins SET items = $1, updated_at = datetime('now') WHERE id = $2", [filtered, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items: { old: current, new: filtered } },
      });
      return { type: 'remove_items', success: true, details: `Removed ${action.items.length} item(s) from ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'modify_item': {
      const bin = querySync('SELECT id, name, items FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      const current: string[] = bin.rows[0].items || [];
      const modified = current.map((i) => i.toLowerCase() === action.old_item.toLowerCase() ? action.new_item : i);
      querySync("UPDATE bins SET items = $1, updated_at = datetime('now') WHERE id = $2", [modified, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { items: { old: current, new: modified } },
      });
      return { type: 'modify_item', success: true, details: `Renamed "${action.old_item}" to "${action.new_item}" in ${action.bin_name}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    case 'create_bin': {
      const binId = generateUuid();
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
            locationId, userId, userName,
            action: 'create', entityType: 'area', entityId: newAreaId, entityName: action.area_name,
          });
        }
      }

      // Generate short code with retry
      let shortCode = generateShortCode();
      const maxRetries = 10;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const code = attempt === 0 ? shortCode : generateShortCode();
        try {
          querySync(
            `INSERT INTO bins (id, location_id, name, area_id, items, notes, tags, icon, color, created_by, short_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [binId, locationId, action.name, areaId, action.items || [], action.notes || '', action.tags || [], action.icon || '', action.color || '', userId, code]
          );
          shortCode = code;
          break;
        } catch (err: unknown) {
          const sqliteErr = err as { code?: string };
          if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < maxRetries) continue;
          throw err;
        }
      }

      pendingActivities.push({
        locationId, userId, userName,
        action: 'create', entityType: 'bin', entityId: binId, entityName: action.name,
      });
      return { type: 'create_bin', success: true, details: `Created bin "${action.name}"`, bin_id: binId, bin_name: action.name };
    }

    case 'delete_bin': {
      const bin = querySync('SELECT id, name FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
      if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
      querySync("UPDATE bins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = $1", [action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName,
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
        locationId, userId, userName,
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
        locationId, userId, userName,
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
        locationId, userId, userName,
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
            locationId, userId, userName,
            action: 'create', entityType: 'area', entityId: newAreaId, entityName: action.area_name,
          });
        }
      }

      querySync("UPDATE bins SET area_id = $1, updated_at = datetime('now') WHERE id = $2", [areaId, action.bin_id]);
      pendingActivities.push({
        locationId, userId, userName,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { area_id: { old: bin.rows[0].area_id, new: areaId } },
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
        locationId, userId, userName,
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
        locationId, userId, userName,
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
        locationId, userId, userName,
        action: 'update', entityType: 'bin', entityId: action.bin_id, entityName: action.bin_name,
        changes: { color: { old: bin.rows[0].color, new: action.color } },
      });
      return { type: 'set_color', success: true, details: `Set color of ${action.bin_name} to ${action.color}`, bin_id: action.bin_id, bin_name: action.bin_name };
    }

    default:
      return { type: (action as { type: string }).type, success: false, details: 'Unknown action type', error: 'Unknown action type' };
  }
}
