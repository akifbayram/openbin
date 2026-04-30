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
    const users = await query<{ id: string; email: string | null; display_name: string | null }>(
      `SELECT id, email, display_name FROM users
       WHERE deletion_scheduled_at IS NOT NULL
         AND ${d.tsCompareNow('deletion_scheduled_at', '<=')}`,
    );

    for (const user of users.rows) {
      try {
        await hardDeleteUser(user.id);
        log.info(`Hard-deleted user ${user.id}`);

        // Fire completion email AFTER the user row is gone — we captured the
        // email above before the delete. EE hook handles the actual sending;
        // self-host with no email config is a no-op.
        if (user.email) {
          void getEeHooks()
            .notifyDeletionCompleted?.(user.id, user.email, user.display_name ?? user.email)
            ?.catch((err) =>
              log.warn(`notifyDeletionCompleted hook threw for user ${user.id}`, err),
            );
        }
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
  // Identify which photo files to delete from storage. We can ONLY delete
  // files for photos whose bin will go away — i.e., bins in sole-member
  // locations that we'll cascade-delete below. Photos in shared bins must
  // keep their files (other members are viewing them); the FK SET NULL on
  // photos.created_by handles attribution.
  //
  // A bin is "going away" if its location has the deleting user as the
  // sole member. The location's bin cascade then takes the photo rows;
  // we just need to clean their files from disk first.
  const filesToDelete = await query<{ storage_path: string; thumb_path: string | null }>(
    `SELECT p.storage_path, p.thumb_path
     FROM photos p
     JOIN bins b ON b.id = p.bin_id
     WHERE b.location_id IN (
       SELECT lm.location_id FROM location_members lm
       WHERE lm.user_id = $1
       GROUP BY lm.location_id HAVING COUNT(*) = 1
     )`,
    [userId],
  );
  for (const photo of filesToDelete.rows) {
    try {
      await storage.delete(photo.storage_path);
      if (photo.thumb_path) await storage.delete(photo.thumb_path);
    } catch { /* ignore file cleanup errors */ }
  }

  // Delete all user data in a transaction. The FK constraints handle the
  // rest:
  //   - bins/photos/locations/areas in shared contexts: created_by SET NULL
  //   - sole-member locations: deleted explicitly below; their bins/photos
  //     cascade automatically
  //   - per-user PII (api_keys, refresh_tokens, etc.): ON DELETE CASCADE
  await withTransaction(async (tx) => {
    await tx('DELETE FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = $1)', [userId]);
    await tx('DELETE FROM api_keys WHERE user_id = $1', [userId]);
    await tx('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    // EE-only deletes (email_log, ai_usage, bin_shares) live behind the
    // hook so they compile away when BUILD_EDITION != cloud. Runs INSIDE
    // the transaction so any failure rolls back the rest of the user data.
    await getEeHooks().onHardDeleteUser?.(tx, userId);

    // Delete sole-member locations first — their bins, photos, attachments,
    // location_members rows cascade. Multi-member locations are preserved;
    // when the user row is deleted below, their location_members entry goes
    // via CASCADE and `bins.created_by` / `photos.created_by` /
    // `attachments.created_by` SET NULL takes care of attribution.
    const soleMemberLocations = await tx<{ location_id: string }>(
      `SELECT location_id FROM location_members
       WHERE user_id = $1
       AND location_id IN (
         SELECT location_id FROM location_members
         GROUP BY location_id HAVING COUNT(*) = 1
       )`,
      [userId],
    );
    for (const row of soleMemberLocations.rows) {
      await tx('DELETE FROM locations WHERE id = $1', [row.location_id]);
    }

    // Now delete the user. FK CASCADE/SET NULL takes care of the rest.
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
