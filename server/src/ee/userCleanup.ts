import { d, query, withTransaction } from '../db.js';
import { config } from '../lib/config.js';
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js';
import { createLogger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';

const log = createLogger('cleanup');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function cleanupDeletedUsers(): Promise<void> {
  if (!(await acquireJobLock('user_cleanup', 7200))) return;
  try {
    const users = await query<{ id: string }>(
      `SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at <= ${d.hoursAgo(1)}`,
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

async function hardDeleteUser(userId: string): Promise<void> {
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
    await tx('DELETE FROM email_log WHERE user_id = $1', [userId]);
    await tx('DELETE FROM ai_usage WHERE user_id = $1', [userId]);
    await tx('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await tx('DELETE FROM bin_shares WHERE created_by = $1', [userId]);
    await tx('DELETE FROM photos WHERE created_by = $1', [userId]);
    await tx('DELETE FROM bins WHERE created_by = $1', [userId]);
    await tx('DELETE FROM location_members WHERE user_id = $1', [userId]);

    // Delete locations owned by this user with no remaining members
    const ownedLocations = await tx<{ id: string }>('SELECT id FROM locations WHERE created_by = $1', [userId]);
    for (const loc of ownedLocations.rows) {
      const memberCount = await tx<{ cnt: number }>('SELECT COUNT(*) as cnt FROM location_members WHERE location_id = $1', [loc.id]);
      if (memberCount.rows[0].cnt === 0) {
        await tx('DELETE FROM locations WHERE id = $1', [loc.id]);
      }
    }

    await tx('DELETE FROM users WHERE id = $1', [userId]);
  });
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startUserCleanupJob(): void {
  if (config.selfHosted) return;
  // Run immediately, then every hour
  cleanupDeletedUsers();
  intervalId = setInterval(cleanupDeletedUsers, CHECK_INTERVAL_MS);
}

export function stopUserCleanupJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
