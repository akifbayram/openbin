import { query, generateUuid } from '../db.js';

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
}

/**
 * Insert an activity log entry and auto-prune old entries.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (id, location_id, user_id, user_name, action, entity_type, entity_id, entity_name, changes, auth_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
      ]
    );

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
