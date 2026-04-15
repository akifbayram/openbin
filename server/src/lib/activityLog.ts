import { d, generateUuid, query } from '../db.js';
import { createLogger } from './logger.js';

const log = createLogger('activity');

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

export type Diff = { old: unknown; new: unknown };
export type Changes = Record<string, Diff>;

type RenameEntry = { old: string; new: string };

/**
 * Merge two `items_renamed` diffs. Two possible output shapes:
 *   - Legacy chain: `{ old: string, new: string }` — a single rename collapsed across a chain.
 *   - Array form:   `{ old: null, new: RenameEntry[] }` — multiple unrelated renames preserved as separate entries.
 *
 * The client's `renderChangeDiff` must handle both shapes (Task 7). `RenameEntry` is file-local;
 * the client uses its own equivalent type.
 */
function mergeItemsRenamed(existing: Diff | undefined, incoming: Diff): Diff {
  // No prior rename — keep the incoming legacy object shape.
  if (!existing) return incoming;

  const incomingPair = { old: String(incoming.old), new: String(incoming.new) };

  // Existing is a legacy {old, new} object.
  if (typeof existing.old === 'string' && typeof existing.new === 'string') {
    // Chain: existing.new === incoming.old → collapse.
    if (existing.new === incomingPair.old) {
      return { old: existing.old, new: incomingPair.new };
    }
    // Non-chain: upgrade to array form.
    return {
      old: null,
      new: [
        { old: existing.old, new: existing.new },
        incomingPair,
      ],
    };
  }

  // Existing is already an array: chain against the last entry or append.
  if (Array.isArray(existing.new)) {
    const arr = existing.new as RenameEntry[];
    const last = arr[arr.length - 1];
    if (last && last.new === incomingPair.old) {
      const updated = [...arr.slice(0, -1), { old: last.old, new: incomingPair.new }];
      return { old: null, new: updated };
    }
    return { old: null, new: [...arr, incomingPair] };
  }

  // Fallback: unrecognised `existing` shape (e.g. data from a future schema or corruption).
  // We replace it with the incoming rename — bounded data loss for this one field only.
  return incoming;
}

/** Merge incoming change fields into an existing changes object. Pure. */
export function mergeBinChanges(existing: Changes, incoming: Changes): Changes {
  const merged: Changes = { ...existing };
  for (const key of Object.keys(incoming)) {
    if (key === 'items_added') {
      const existingNew = (merged[key]?.new as string[] | undefined) ?? [];
      const incomingNew = (incoming[key].new as string[] | undefined) ?? [];
      merged[key] = { old: merged[key]?.old ?? null, new: [...existingNew, ...incomingNew] };
    } else if (key === 'items_removed') {
      const existingOld = (merged[key]?.old as string[] | undefined) ?? [];
      const incomingOld = (incoming[key].old as string[] | undefined) ?? [];
      merged[key] = { old: [...existingOld, ...incomingOld], new: merged[key]?.new ?? null };
    } else if (key === 'items_renamed') {
      merged[key] = mergeItemsRenamed(merged[key], incoming[key]);
    } else if (key === 'items_quantity') {
      merged[key] = {
        old: Object.prototype.hasOwnProperty.call(merged, key) ? merged[key].old : incoming[key].old,
        new: incoming[key].new,
      };
    } else {
      // Scalar / tag array / other fields: keep earliest old, adopt latest new.
      const existingOld = Object.prototype.hasOwnProperty.call(merged, key) ? merged[key].old : incoming[key].old;
      merged[key] = { old: existingOld, new: incoming[key].new };
    }
  }
  return merged;
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
async function tryMerge(opts: LogActivityOptions): Promise<boolean> {
  if (!opts.changes || !isMergeableChanges(opts.changes)) return false;

  const result = await query<{ id: string; changes: Record<string, { old: unknown; new: unknown }> }>(
    `SELECT id, changes FROM activity_log
     WHERE user_id = $1 AND action = $2 AND entity_type = $3 AND entity_id = $4
       AND location_id = $5 AND ${d.nullableEq('auth_method', '$6')}
       AND created_at > ${d.secondsAgo(MERGE_WINDOW_SECONDS)}
     ORDER BY created_at DESC LIMIT 1`,
    [opts.userId, opts.action, opts.entityType, opts.entityId ?? null, opts.locationId, opts.authMethod ?? null]
  );

  if (result.rows.length === 0) return false;

  const existing = result.rows[0];
  if (!existing.changes || !isMergeableChanges(existing.changes)) return false;

  const merged = mergeBinChanges(existing.changes, opts.changes);

  await query(
    `UPDATE activity_log SET changes = $1, created_at = ${d.now()}, entity_name = $2 WHERE id = $3`,
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
    if (await tryMerge(opts)) {
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
         AND created_at < ${d.intervalDaysAgo('(SELECT activity_retention_days FROM locations WHERE id = $1)')}`,
      [opts.locationId]
    ).catch(() => { /* ignore prune errors */ });
  } catch (err) {
    log.error('Failed to log activity:', err instanceof Error ? err.message : err);
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
