import { d, query, withTransaction } from '../db.js';
import { invalidateUserStatusCache } from '../middleware/auth.js';
import { logAdminAction } from './adminAudit.js';
import { config } from './config.js';
import type { CancellationResult } from './eeHooks.js';
import { getEeHooks } from './eeHooks.js';
import { ConflictError, ForbiddenError, NotFoundError } from './httpErrors.js';
import { createLogger } from './logger.js';
import { revokeAllUserTokens } from './refreshTokens.js';

const log = createLogger('accountDeletion');

export interface DeletionRequest {
  userId: string;
  refundPolicy: 'none' | 'prorated';
  /** When set, this is an admin-initiated deletion. Recorded in admin_audit_log. */
  initiatedByAdminId?: string;
  /** Display name for admin_audit_log when initiatedByAdminId is set. */
  initiatedByAdminName?: string;
}

export interface DeletionResult {
  scheduledAt: string | null;
  cancellation?: CancellationResult;
}

interface UserRow {
  email: string;
  is_admin: number | boolean;
  deletion_requested_at: string | null;
}

/**
 * Soft-delete a user with a configurable grace period for recovery.
 *
 * Steps:
 *   1. Validate the user exists and isn't already pending deletion.
 *   2. If user is admin, ensure at least one OTHER non-pending admin remains.
 *   3. Cloud only: cancel the Stripe subscription FIRST. If billing reports an
 *      active subscription that failed to cancel, abort with ConflictError so
 *      the user is never deleted while still being charged.
 *   4. Inside a transaction, set deletion_requested_at, deletion_scheduled_at,
 *      deleted_at, deletion_reason.
 *   5. Revoke refresh tokens and bust the user-status cache.
 *   6. Record admin_audit_log when admin-initiated, plus a regular log line.
 *   7. If grace=0 jump straight to hard delete (TODO: requires Task 1.2).
 *      Otherwise fire-and-forget `notifyDeletionScheduled` for cloud emails.
 */
export async function requestDeletion(req: DeletionRequest): Promise<DeletionResult> {
  const { userId, refundPolicy, initiatedByAdminId, initiatedByAdminName } = req;

  // 1. Look up user
  const userResult = await query<UserRow>(
    'SELECT email, is_admin, deletion_requested_at FROM users WHERE id = $1',
    [userId],
  );
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  const user = userResult.rows[0];
  const userEmail = user.email;
  const isAdmin = user.is_admin === true || user.is_admin === 1;

  // 2. Already pending?
  if (user.deletion_requested_at) {
    throw new ConflictError('Account deletion is already pending');
  }

  // 3. Sole-admin guard
  if (isAdmin) {
    const adminCountResult = await query<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM users
       WHERE is_admin = TRUE AND deletion_requested_at IS NULL AND id != $1`,
      [userId],
    );
    const otherAdmins = Number(adminCountResult.rows[0]?.count ?? 0);
    if (otherAdmins < 1) {
      throw new ForbiddenError('Cannot delete the only admin account');
    }
  }

  // 4. Cloud only: cancel subscription FIRST so we never soft-delete a user
  // who is still being billed. If billing reports an active sub that failed
  // to cancel, fail closed.
  let cancellation: CancellationResult | undefined;
  if (!config.selfHosted) {
    const hooks = getEeHooks();
    if (hooks.cancelSubscription) {
      cancellation = await hooks.cancelSubscription({ userId, refundPolicy });
      if (!cancellation.cancelled && cancellation.hadActiveSubscription) {
        throw new ConflictError(
          `Subscription cancellation failed: ${cancellation.reason ?? 'unknown'}`,
        );
      }
    }
  }

  // 5. Compute scheduledAt
  const grace = config.deletionGracePeriodDays;
  const scheduledAt =
    grace > 0 ? new Date(Date.now() + grace * 24 * 3600 * 1000).toISOString() : null;
  const deletionReason = initiatedByAdminId ? 'admin_initiated' : 'user_initiated';

  // 6. Soft-delete in a transaction
  await withTransaction(async (tx) => {
    await tx(
      `UPDATE users SET
         deletion_requested_at = ${d.now()},
         deletion_scheduled_at = $1,
         deleted_at = ${d.now()},
         deletion_reason = $2,
         updated_at = ${d.now()}
       WHERE id = $3`,
      [scheduledAt, deletionReason, userId],
    );
  });

  // 7. Revoke tokens and bust cache after the txn commits
  await revokeAllUserTokens(userId);
  invalidateUserStatusCache(userId);

  // 8. Audit logging
  if (initiatedByAdminId) {
    logAdminAction({
      actorId: initiatedByAdminId,
      actorName: initiatedByAdminName ?? 'admin',
      action: 'request_account_deletion',
      targetType: 'user',
      targetId: userId,
      targetName: userEmail,
      details: {
        refundPolicy,
        scheduledAt,
        hadActiveSubscription: !!cancellation?.hadActiveSubscription,
        refundAmountCents: cancellation?.refundAmountCents,
      },
    });
    log.info(
      `Account deletion requested by admin ${initiatedByAdminId} (${initiatedByAdminName ?? 'admin'}) for user ${userId} (${userEmail}); scheduledAt=${scheduledAt ?? 'immediate'}`,
    );
  } else {
    log.info(
      `Account deletion self-initiated for user ${userId} (${userEmail}); scheduledAt=${scheduledAt ?? 'immediate'}`,
    );
  }

  // 9. Grace=0: immediately hard-delete. Task 1.2 will create userCleanup.ts
  // with hardDeleteUser(); for now we fail loudly so callers can't accidentally
  // rely on this code path.
  if (grace === 0) {
    // TODO(Task 1.2): import { hardDeleteUser } from './userCleanup.js' and call it here.
    throw new Error('grace=0 immediate hard-delete not yet implemented (Task 1.2)');
  }

  // 10. Fire-and-forget cloud notification (non-zero grace path)
  try {
    getEeHooks().notifyDeletionScheduled?.(
      userId,
      scheduledAt!,
      !!cancellation?.hadActiveSubscription,
      cancellation?.refundAmountCents,
    );
  } catch (err) {
    log.warn(`notifyDeletionScheduled hook threw for user ${userId}`, err);
  }

  return { scheduledAt, cancellation };
}

interface RecoveryRow {
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
}

/**
 * Restore a soft-deleted user during the grace window. Clears all four
 * deletion fields and busts the user-status cache so the next request
 * sees them as a normal active account.
 */
export async function recoverDeletion(userId: string): Promise<void> {
  const result = await query<RecoveryRow>(
    'SELECT deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  const row = result.rows[0];

  if (!row.deletion_requested_at) {
    throw new ConflictError('Account is not pending deletion');
  }

  if (row.deletion_scheduled_at && new Date(row.deletion_scheduled_at).getTime() < Date.now()) {
    throw new ConflictError('Grace period has expired; account cannot be recovered');
  }

  await query(
    `UPDATE users SET
       deletion_requested_at = NULL,
       deletion_scheduled_at = NULL,
       deleted_at = NULL,
       deletion_reason = NULL,
       updated_at = ${d.now()}
     WHERE id = $1`,
    [userId],
  );

  invalidateUserStatusCache(userId);
  log.info(`Account deletion recovered for user ${userId}`);
}
