import { query } from '../db.js';

export interface LogActivityOptions {
  locationId: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

/**
 * Insert an activity log entry and auto-prune old entries.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (location_id, user_id, user_name, action, entity_type, entity_id, entity_name, changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        opts.locationId,
        opts.userId,
        opts.userName,
        opts.action,
        opts.entityType,
        opts.entityId ?? null,
        opts.entityName ?? null,
        opts.changes ? JSON.stringify(opts.changes) : null,
      ]
    );

    // Auto-prune entries older than 90 days (non-blocking, best-effort)
    query(
      `DELETE FROM activity_log WHERE location_id = $1 AND created_at < NOW() - INTERVAL '90 days'`,
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
