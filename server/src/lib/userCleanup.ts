import { d, query, withTransaction } from '../db.js';
import { getEeHooks } from './eeHooks.js';
import { acquireJobLock, releaseJobLock } from './jobLock.js';
import { createLogger } from './logger.js';
import { storage } from './storage.js';

const log = createLogger('cleanup');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Pick up users whose grace window has elapsed and hard-delete them.
 *
 * Drives off `deletion_scheduled_at` (set by `requestDeletion`) rather than
 * the legacy `deleted_at + 1h` heuristic so the cleanup respects the
 * configurable grace period (`config.deletionGracePeriodDays`).
 */
export async function cleanupDeletedUsers(): Promise<void> {
  if (!(await acquireJobLock('user_cleanup', 7200))) return;
  try {
    const users = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE deletion_scheduled_at IS NOT NULL
         AND ${d.tsCompareNow('deletion_scheduled_at', '<=')}`,
    );

    for (const user of users.rows) {
      try {
        await hardDeleteUser(user.id);
        log.info(`Hard-deleted user ${user.id}`);
      } catch (err) {
        log.error(`Failed to hard-delete user ${user.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    log.error('User cleanup check failed:', err instanceof Error ? err.message : err);
  } finally {
    await releaseJobLock('user_cleanup');
  }
}

/**
 * Hard-delete a user and their owned data. Runs in both editions.
 *
 * Steps:
 *   1. Best-effort delete the user's photo files from storage (cannot be
 *      transactional with the DB, so do it first; orphaned rows would be
 *      cleaned by the next sweep, but orphaned files never would).
 *   2. In a single transaction, remove all rows the user owns. Core lib
 *      tables (api_keys, photos, bins, location_members, locations) are
 *      handled here; EE-only tables are reaped by the `onHardDeleteUser`
 *      hook running inside the same transaction.
 *   3. After commit, fire-and-forget the EE billing customer cleanup so
 *      the Stripe customer record is reaped at hard-delete time.
 *
 * Owned locations with remaining members are PRESERVED — `bins.created_by`
 * and `locations.created_by` clear to NULL via `ON DELETE SET NULL` when the
 * user row goes, so co-members keep using the location.
 */
export async function hardDeleteUser(userId: string): Promise<void> {
  // Delete photo files first (before DB rows are removed)
  const photos = await query<{ id: string; storage_path: string; thumb_path: string | null }>(
    'SELECT id, storage_path, thumb_path FROM photos WHERE created_by = $1',
    [userId],
  );
  for (const photo of photos.rows) {
    try {
      await storage.delete(photo.storage_path);
      if (photo.thumb_path) await storage.delete(photo.thumb_path);
    } catch { /* ignore file cleanup errors */ }
  }

  // Delete all user data in a transaction
  await withTransaction(async (tx) => {
    await tx('DELETE FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = $1)', [userId]);
    await tx('DELETE FROM api_keys WHERE user_id = $1', [userId]);
    await tx('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    // EE-only deletes (email_log, ai_usage, bin_shares) live behind the
    // hook so they compile away when BUILD_EDITION != cloud. Runs INSIDE
    // the transaction so any failure rolls back the rest of the user data.
    await getEeHooks().onHardDeleteUser?.(tx, userId);

    await tx('DELETE FROM photos WHERE created_by = $1', [userId]);
    await tx('DELETE FROM bins WHERE created_by = $1', [userId]);
    await tx('DELETE FROM location_members WHERE user_id = $1', [userId]);

    // Delete locations owned by this user with no remaining members.
    // Locations with remaining members are preserved; their created_by
    // resets to NULL via ON DELETE SET NULL when the user row goes below.
    const ownedLocations = await tx<{ id: string }>('SELECT id FROM locations WHERE created_by = $1', [userId]);
    for (const loc of ownedLocations.rows) {
      const memberCount = await tx<{ cnt: number }>('SELECT COUNT(*) as cnt FROM location_members WHERE location_id = $1', [loc.id]);
      if (memberCount.rows[0].cnt === 0) {
        await tx('DELETE FROM locations WHERE id = $1', [loc.id]);
      }
    }

    await tx('DELETE FROM users WHERE id = $1', [userId]);
  });

  // Fire-and-forget billing customer cleanup once the DB transaction commits.
  // Best-effort: a failure here just leaves an orphan Stripe customer that
  // can be reaped later; the user row is already gone.
  void getEeHooks()
    .deleteBillingCustomer?.(userId)
    ?.catch((err) =>
      log.warn(`Billing customer cleanup failed for ${userId}`, err),
    );
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startUserCleanupJob(): void {
  // Runs in BOTH editions: self-host needs the cleanup too so users who
  // request deletion actually get hard-deleted after the grace window.
  // Run immediately, then every hour.
  cleanupDeletedUsers();
  intervalId = setInterval(cleanupDeletedUsers, CHECK_INTERVAL_MS);
}

export function stopUserCleanupJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
