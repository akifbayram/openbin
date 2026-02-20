import { query, querySync, generateUuid } from '../db.js';

export interface LogActivityOptions {
  locationId: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  authMethod?: 'jwt' | 'api_key';
  apiKeyId?: string;
}

const MERGEABLE_FIELDS = new Set(['items_added', 'items_removed']);
const MERGE_WINDOW_SECONDS = 120;

/**
 * Check if all keys in a changes object are mergeable item fields.
 */
function isMergeableChanges(changes: Record<string, { old: unknown; new: unknown }>): boolean {
  const keys = Object.keys(changes);
  return keys.length > 0 && keys.every(k => MERGEABLE_FIELDS.has(k));
}

/**
 * Try to merge a new activity entry into a recent existing one.
 * Returns true if merged (caller should skip INSERT).
 */
function tryMerge(opts: LogActivityOptions): boolean {
  if (!opts.changes || !isMergeableChanges(opts.changes)) return false;

  const result = querySync<{ id: string; changes: Record<string, { old: unknown; new: unknown }> }>(
    `SELECT id, changes FROM activity_log
     WHERE user_id = $1 AND action = $2 AND entity_type = $3 AND entity_id = $4
       AND location_id = $5 AND auth_method IS $6
       AND created_at > datetime('now', '-${MERGE_WINDOW_SECONDS} seconds')
     ORDER BY created_at DESC LIMIT 1`,
    [opts.userId, opts.action, opts.entityType, opts.entityId ?? null, opts.locationId, opts.authMethod ?? null]
  );

  if (result.rows.length === 0) return false;

  const existing = result.rows[0];
  if (!existing.changes || !isMergeableChanges(existing.changes)) return false;

  // Merge arrays
  const merged: Record<string, { old: unknown; new: unknown }> = { ...existing.changes };
  for (const key of Object.keys(opts.changes)) {
    if (key === 'items_added') {
      const existingNew = (merged[key]?.new as string[] | undefined) ?? [];
      const incomingNew = (opts.changes[key].new as string[] | undefined) ?? [];
      merged[key] = { old: merged[key]?.old ?? null, new: [...existingNew, ...incomingNew] };
    } else if (key === 'items_removed') {
      const existingOld = (merged[key]?.old as string[] | undefined) ?? [];
      const incomingOld = (opts.changes[key].old as string[] | undefined) ?? [];
      merged[key] = { old: [...existingOld, ...incomingOld], new: merged[key]?.new ?? null };
    }
  }

  querySync(
    `UPDATE activity_log SET changes = $1, created_at = datetime('now'), entity_name = $2 WHERE id = $3`,
    [JSON.stringify(merged), opts.entityName ?? null, existing.id]
  );

  return true;
}

/**
 * Insert an activity log entry and auto-prune old entries.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * Item additions/removals within a 2-minute window on the same bin
 * are merged into a single entry to reduce noise.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    if (tryMerge(opts)) {
      // Merged into existing entry — skip INSERT, still prune
    } else {
      await query(
        `INSERT INTO activity_log (id, location_id, user_id, user_name, action, entity_type, entity_id, entity_name, changes, auth_method, api_key_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          generateUuid(),
          opts.locationId,
          opts.userId,
          opts.userName,
          opts.action,
          opts.entityType,
          opts.entityId ?? null,
          opts.entityName ?? null,
          opts.changes ? JSON.stringify(opts.changes) : null,
          opts.authMethod ?? null,
          opts.apiKeyId ?? null,
        ]
      );
    }

    // Auto-prune entries past the location's retention setting (best-effort)
    query(
      `DELETE FROM activity_log
       WHERE location_id = $1
         AND created_at < datetime('now', '-' || (SELECT activity_retention_days FROM locations WHERE id = $1) || ' days')`,
      [opts.locationId]
    ).catch(() => { /* ignore prune errors */ });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

/**
 * Compute a simple diff between old and new objects for the changes JSONB field.
 * Only includes fields that actually changed.
 */
export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | undefined {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (newVal === undefined) continue;
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    if (oldStr !== newStr) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}
