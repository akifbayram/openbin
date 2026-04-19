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

type Diff = { old: unknown; new: unknown };
type Changes = Record<string, Diff>;

type RenameEntry = { old: string; new: string };

/**
 * Merge two `items_renamed` diffs. Two possible output shapes:
 *   - Legacy chain: `{ old: string, new: string }` — a single rename collapsed across a chain.
 *   - Array form:   `{ old: null, new: RenameEntry[] }` — multiple unrelated renames preserved as separate entries.
 *
 * The client's `renderChangeDiff` must handle both shapes.
 */
function mergeItemsRenamed(existing: Diff | undefined, incoming: Diff): Diff {
  if (!existing) return incoming;

  const incomingPair = { old: String(incoming.old), new: String(incoming.new) };

  if (typeof existing.old === 'string' && typeof existing.new === 'string') {
    if (existing.new === incomingPair.old) {
      return { old: existing.old, new: incomingPair.new };
    }
    return {
      old: null,
      new: [
        { old: existing.old, new: existing.new },
        incomingPair,
      ],
    };
  }

  if (Array.isArray(existing.new)) {
    const arr = existing.new as RenameEntry[];
    const last = arr[arr.length - 1];
    if (last && last.new === incomingPair.old) {
      const updated = [...arr.slice(0, -1), { old: last.old, new: incomingPair.new }];
      return { old: null, new: updated };
    }
    return { old: null, new: [...arr, incomingPair] };
  }

  // Unrecognised `existing` shape (future schema / corruption): replace rather than throw —
  // bounded data loss for this one field beats dropping the entire merge.
  return incoming;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Remove change-fields whose values net out to no-op:
 *  - scalar/array fields where old and new are deep-equal
 *  - items_added / items_removed intersections (foo added then removed, or vice versa)
 *  - items_renamed entries where old === new (object or array form)
 *  - items_quantity where qty did not change
 *
 * Returns a new object; input is not mutated.
 */
export function cancelReverts(changes: Changes): Changes {
  const out: Changes = { ...changes };

  // items_added ∩ items_removed cancellation
  if (out.items_added && out.items_removed) {
    const addedArr = (out.items_added.new as string[] | null) ?? [];
    const removedArr = (out.items_removed.old as string[] | null) ?? [];
    const both = new Set(addedArr.filter((x) => removedArr.includes(x)));
    if (both.size > 0) {
      const nextAdded = addedArr.filter((x) => !both.has(x));
      const nextRemoved = removedArr.filter((x) => !both.has(x));
      if (nextAdded.length === 0) delete out.items_added;
      else out.items_added = { old: null, new: nextAdded };
      if (nextRemoved.length === 0) delete out.items_removed;
      else out.items_removed = { old: nextRemoved, new: null };
    }
  }

  // Other keys: per-key revert handling.
  for (const key of Object.keys(out)) {
    const diff = out[key];
    if (!diff) {
      delete out[key];
      continue;
    }

    if (key === 'items_added' || key === 'items_removed') continue; // already handled

    if (key === 'items_renamed') {
      if (Array.isArray(diff.new)) {
        const entries = (diff.new as Array<{ old: string; new: string }>).filter((e) => e.old !== e.new);
        if (entries.length === 0) delete out[key];
        else out[key] = { old: null, new: entries };
      } else if (typeof diff.old === 'string' && typeof diff.new === 'string' && diff.old === diff.new) {
        delete out[key];
      }
      continue;
    }

    if (key === 'items_quantity') {
      const oldQty = (diff.old as { qty?: number } | null | undefined)?.qty;
      const newQty = (diff.new as { qty?: number } | null | undefined)?.qty;
      if (oldQty === newQty) delete out[key];
      continue;
    }

    // Scalar / array fields
    if (jsonEqual(diff.old, diff.new)) {
      delete out[key];
    }
  }

  return out;
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
        old: Object.hasOwn(merged, key) ? merged[key].old : incoming[key].old,
        new: incoming[key].new,
      };
    } else {
      // Scalar / tag array / other fields: keep earliest old, adopt latest new.
      // `Object.hasOwn` (not `merged[key]?.old ?? ...`) to preserve explicit `undefined` olds.
      const existingOld = Object.hasOwn(merged, key) ? merged[key].old : incoming[key].old;
      merged[key] = { old: existingOld, new: incoming[key].new };
    }
  }
  return merged;
}

const MERGE_WINDOW_SECONDS = 120;

/**
 * Try to merge a new bin-update activity entry into a recent existing one.
 * Returns true if handled (caller should skip INSERT).
 *
 * Note: the SELECT + UPDATE/DELETE here is not atomic across concurrent
 * same-user PUTs on the same bin. Worst case is two rows instead of one —
 * acceptable; same behavior as before this extension.
 */
async function tryMerge(opts: LogActivityOptions): Promise<boolean> {
  if (opts.action !== 'update' || opts.entityType !== 'bin' || !opts.changes) {
    return false;
  }

  const result = await query<{ id: string; changes: Changes | null }>(
    `SELECT id, changes FROM activity_log
     WHERE user_id = $1 AND action = $2 AND entity_type = $3 AND entity_id = $4
       AND location_id = $5 AND ${d.nullableEq('auth_method', '$6')}
       AND created_at > ${d.secondsAgo(MERGE_WINDOW_SECONDS)}
     ORDER BY created_at DESC LIMIT 1`,
    [opts.userId, opts.action, opts.entityType, opts.entityId ?? null, opts.locationId, opts.authMethod ?? null],
  );

  if (result.rows.length === 0) return false;

  const existing = result.rows[0];
  const merged = cancelReverts(mergeBinChanges(existing.changes ?? {}, opts.changes));

  if (Object.keys(merged).length === 0) {
    await query('DELETE FROM activity_log WHERE id = $1', [existing.id]);
    return true;
  }

  // Advance created_at to "now" so the merged row reflects the most recent edit time.
  await query(
    `UPDATE activity_log SET changes = $1, created_at = ${d.now()}, entity_name = $2 WHERE id = $3`,
    [JSON.stringify(merged), opts.entityName ?? null, existing.id],
  );
  return true;
}

/**
 * Insert an activity log entry and auto-prune old entries.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * Bin updates from the same user on the same bin within a 2-minute window
 * are merged into a single entry (all fields, not just items). If the merged
 * changes net to nothing (revert cancellation), the existing row is deleted.
 * See `tryMerge` for details.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    if (!(await tryMerge(opts))) {
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
