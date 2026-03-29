import { getDb, query } from '../db.js';
import { config } from './config.js';
import { acquireJobLock, releaseJobLock } from './jobLock.js';
import { storage } from './storage.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function cleanupDeletedUsers(): Promise<void> {
  if (!acquireJobLock('user_cleanup', 7200)) return;
  try {
    const users = await query<{ id: string }>(
      `SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at <= datetime('now', '-1 hour')`,
    );

    for (const user of users.rows) {
      try {
        await hardDeleteUser(user.id);
        console.log(`[cleanup] Hard-deleted user ${user.id}`);
      } catch (err) {
        console.error(`[cleanup] Failed to hard-delete user ${user.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[cleanup] User cleanup check failed:', err instanceof Error ? err.message : err);
  } finally {
    releaseJobLock('user_cleanup');
  }
}

async function hardDeleteUser(userId: string): Promise<void> {
  // Delete photo files first (before DB rows are removed)
  const photos = await query<{ id: string; storage_path: string; thumb_path: string | null }>(
    'SELECT id, storage_path, thumb_path FROM photos WHERE created_by = ?',
    [userId],
  );
  for (const photo of photos.rows) {
    try {
      await storage.delete(photo.storage_path);
      if (photo.thumb_path) await storage.delete(photo.thumb_path);
    } catch { /* ignore file cleanup errors */ }
  }

  // Delete all user data in a transaction
  const db = getDb();
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM email_log WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM ai_usage WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM bin_shares WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM photos WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM bins WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM location_members WHERE user_id = ?').run(userId);

    // Delete locations owned by this user with no remaining members
    const ownedLocations = db.prepare('SELECT id FROM locations WHERE created_by = ?').all(userId) as { id: string }[];
    for (const loc of ownedLocations) {
      const memberCount = (db.prepare('SELECT COUNT(*) as cnt FROM location_members WHERE location_id = ?').get(loc.id) as { cnt: number }).cnt;
      if (memberCount === 0) {
        db.prepare('DELETE FROM locations WHERE id = ?').run(loc.id);
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  deleteAll();
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
