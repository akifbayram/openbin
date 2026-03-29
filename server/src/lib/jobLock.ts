import crypto from 'node:crypto';
import { getDb } from '../db.js';

const instanceId = crypto.randomUUID();

/**
 * Attempt to acquire a named lock for background job execution.
 * Uses SQLite's single-writer guarantee for atomicity.
 *
 * @param jobName - Unique name for the job
 * @param durationSeconds - How long the lock should be held
 * @returns true if lock was acquired, false if another instance holds it
 */
export function acquireJobLock(jobName: string, durationSeconds: number): boolean {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO job_locks (job_name, locked_by, locked_at, expires_at)
     VALUES (?, ?, datetime('now'), datetime('now', '+' || ? || ' seconds'))
     ON CONFLICT(job_name) DO UPDATE
     SET locked_by = excluded.locked_by, locked_at = datetime('now'),
         expires_at = datetime('now', '+' || ? || ' seconds')
     WHERE job_locks.expires_at < datetime('now') OR job_locks.locked_by = ?`,
    )
    .run(jobName, instanceId, durationSeconds, durationSeconds, instanceId);

  return result.changes > 0;
}

/** Release a lock early (e.g., when a job finishes before its lock expires). */
export function releaseJobLock(jobName: string): void {
  const db = getDb();
  db.prepare('DELETE FROM job_locks WHERE job_name = ? AND locked_by = ?').run(jobName, instanceId);
}
