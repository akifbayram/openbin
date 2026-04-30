import { d, query, withTransaction } from '../db.js';
import { invalidateUserStatusCache } from '../middleware/auth.js';
import { logAdminAction } from './adminAudit.js';
import { config } from './config.js';
import type { CancellationResult } from './eeHooks.js';
import { getEeHooks } from './eeHooks.js';
import { ConflictError, ForbiddenError, NotFoundError } from './httpErrors.js';
import { createLogger } from './logger.js';
import { revokeAllUserTokens } from './refreshTokens.js';
import { hardDeleteUser } from './userCleanup.js';

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
 * Request account deletion with a configurable grace period for recovery.
 *
 * Steps:
 *   1. Validate the user exists and isn't already pending deletion.
 *   2. If user is admin, ensure at least one OTHER non-pending admin remains.
 *   3. Cloud only: cancel the Stripe subscription FIRST. If billing reports an
 *      active subscription that failed to cancel, abort with ConflictError so
 *      the user is never deleted while still being charged.
 *   4. If `config.deletionGracePeriodDays === 0`: skip soft-delete entirely;
 *      call `hardDeleteUser` directly AFTER cancellation has succeeded, then
 *      audit + return. The user row goes away in one shot rather than
 *      transitioning through a recoverable middle state.
 *   5. Otherwise: inside a transaction, set deletion_requested_at,
 *      deletion_scheduled_at, deleted_at, deletion_reason. Revoke refresh
 *      tokens, bust the user-status cache, write the admin audit log, and
 *      fire-and-forget `notifyDeletionScheduled` for cloud emails.
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
  const isAdmin = !!user.is_admin;

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

  // 3b. Sole admin of a shared location → must transfer ownership first.
  // Only blocks when (a) user has admin role on the location AND (b) the
  // location has other members AND (c) no other admin remains. Sole-member
  // locations are fine — they get cleaned up alongside the user.
  const orphanedLocations = await query<{ id: string; name: string }>(
    `SELECT l.id, l.name FROM locations l
     WHERE l.id IN (
       SELECT location_id FROM location_members
       WHERE user_id = $1 AND role = 'admin'
     )
     AND (SELECT COUNT(*) FROM location_members lm2 WHERE lm2.location_id = l.id) > 1
     AND (SELECT COUNT(*) FROM location_members lm3 WHERE lm3.location_id = l.id AND lm3.role = 'admin' AND lm3.user_id != $1) = 0`,
    [userId],
  );

  if (orphanedLocations.rows.length > 0) {
    throw new ConflictError({
      code: 'SOLE_ADMIN_OF_SHARED_LOCATIONS',
      message:
        'You are the sole admin of locations shared with others. Promote another member to admin or remove the other members before deleting your account.',
      locations: orphanedLocations.rows.map((l) => ({ id: l.id, name: l.name })),
    });
  }

  // 4. Cloud only: cancel subscription FIRST so we never delete a user who
  // is still being billed. If billing reports an active sub that failed to
  // cancel, fail closed. Done BEFORE the grace=0 hard-delete branch so the
  // immediate path also gets cancellation-before-mutation safety.
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

  // 5. Compute grace + deletion reason
  const grace = config.deletionGracePeriodDays;
  const deletionReason = initiatedByAdminId ? 'admin_initiated' : 'user_initiated';

  // 6. Grace=0 fast path: hard-delete immediately, skipping the soft-delete
  // window entirely. Cancellation already ran above so this is the same
  // shape as the regular path minus the recoverable middle state.
  if (grace === 0) {
    await hardDeleteUser(userId);
    if (initiatedByAdminId) {
      if (initiatedByAdminId !== 'system') {
        logAdminAction({
          actorId: initiatedByAdminId,
          actorName: initiatedByAdminName ?? 'admin',
          action: 'hard_delete_account',
          targetType: 'user',
          targetId: userId,
          targetName: userEmail,
          details: {
            refundPolicy,
            hadActiveSubscription: !!cancellation?.hadActiveSubscription,
            refundAmountCents: cancellation?.refundAmountCents,
          },
        });
      }
      log.info(
        `Hard-deleted account by ${initiatedByAdminId} (${initiatedByAdminName ?? 'admin'}) for user ${userId} (${userEmail})`,
      );
    } else {
      log.info(`Hard-deleted account self-initiated for user ${userId} (${userEmail})`);
    }
    return { scheduledAt: null, cancellation };
  }

  // grace > 0 from here on — non-null scheduledAt narrowed for the hooks below.
  const scheduledAt = new Date(Date.now() + grace * 24 * 3600 * 1000).toISOString();

  // 7. Soft-delete in a transaction
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

  // 8. Revoke tokens and bust cache after the txn commits
  await revokeAllUserTokens(userId);
  invalidateUserStatusCache(userId);

  // 9. Audit logging
  if (initiatedByAdminId) {
    // Skip admin_audit_log for synthetic system actors (e.g. inactivityChecker
    // passes 'system'). admin_audit_log.actor_id has a NOT NULL FK to users(id)
    // and logAdminAction silently swallows insert failures, so synthetic IDs
    // would just disappear into the .catch. The regular log line below covers
    // the audit need for system-initiated deletions.
    if (initiatedByAdminId !== 'system') {
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
    }
    log.info(
      `Account deletion requested by ${initiatedByAdminId} (${initiatedByAdminName ?? 'admin'}) for user ${userId} (${userEmail}); scheduledAt=${scheduledAt}`,
    );
  } else {
    log.info(
      `Account deletion self-initiated for user ${userId} (${userEmail}); scheduledAt=${scheduledAt}`,
    );
  }

  // 10. Fire-and-forget cloud notification. The hook may not be installed
  // (`?.notifyDeletionScheduled`) and may return either a Promise or undefined;
  // the optional-chained `.catch` swallows the absent-promise case safely.
  void getEeHooks()
    .notifyDeletionScheduled?.(
      userId,
      scheduledAt,
      !!cancellation?.hadActiveSubscription,
      cancellation?.refundAmountCents,
    )
    ?.catch((err) =>
      log.warn(`notifyDeletionScheduled hook threw for user ${userId}`, err),
    );

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

  // Fire-and-forget recovery email (cloud only — needs EE hook registration).
  // Look up email + displayName since the hook signature doesn't carry them.
  const userRow = await query<{ email: string | null; display_name: string | null }>(
    'SELECT email, display_name FROM users WHERE id = $1',
    [userId],
  );
  const u = userRow.rows[0];
  if (u?.email) {
    void getEeHooks()
      .notifyDeletionRecovered?.(userId, u.email, u.display_name ?? u.email)
      ?.catch((err) =>
        log.warn(`notifyDeletionRecovered hook threw for user ${userId}`, err),
      );
  }
}
