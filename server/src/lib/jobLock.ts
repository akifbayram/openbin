import crypto from 'node:crypto';
import { d, query } from '../db.js';

const instanceId = crypto.randomUUID();

/**
 * Attempt to acquire a named lock for background job execution.
 *
 * @param jobName - Unique name for the job
 * @param durationSeconds - How long the lock should be held
 * @returns true if lock was acquired, false if another instance holds it
 */
export async function acquireJobLock(jobName: string, durationSeconds: number): Promise<boolean> {
  const result = await query(
    `INSERT INTO job_locks (job_name, locked_by, locked_at, expires_at)
     VALUES ($1, $2, ${d.now()}, ${d.intervalSeconds('$3')})
     ON CONFLICT(job_name) DO UPDATE
     SET locked_by = excluded.locked_by, locked_at = ${d.now()},
         expires_at = ${d.intervalSeconds('$4')}
     WHERE job_locks.expires_at < ${d.now()} OR job_locks.locked_by = $5`,
    [jobName, instanceId, durationSeconds, durationSeconds, instanceId],
  );
  return result.rowCount > 0;
}

/** Release a lock early (e.g., when a job finishes before its lock expires). */
export async function releaseJobLock(jobName: string): Promise<void> {
  await query('DELETE FROM job_locks WHERE job_name = $1 AND locked_by = $2', [jobName, instanceId]);
}
