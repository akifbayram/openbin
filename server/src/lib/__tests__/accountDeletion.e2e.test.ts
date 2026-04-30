import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUuid, query } from '../../db.js';

// Mock config so we can flip selfHosted on a per-test basis. Mirrors the
// pattern in accountDeletion.test.ts.
vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: { ...original.config },
  };
});

// Subjects under test
import { recoverDeletion, requestDeletion } from '../accountDeletion.js';
import { config } from '../config.js';
import { registerEeHooks } from '../eeHooks.js';
import { cleanupDeletedUsers } from '../userCleanup.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CreateUserOpts {
  email?: string;
}

async function createUserDirect(opts: CreateUserOpts = {}): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO users (id, email, password_hash, display_name, is_admin)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, opts.email ?? `u${id.slice(0, 8)}@test.local`, 'hash', 'Test User', 0],
  );
  return id;
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const result = await query<T>(sql, params);
  return result.rows[0] as T;
}

// Reset hooks to no-ops by registering undefined entries. This matches the
// approach used in accountDeletion.test.ts.
function resetEeHooks(): void {
  registerEeHooks({
    cancelSubscription: undefined as never,
    notifyDeletionScheduled: undefined as never,
    notifyDeletionRecovered: undefined as never,
    notifyDeletionCompleted: undefined as never,
    deleteBillingCustomer: undefined as never,
    onHardDeleteUser: undefined as never,
  });
}

const originalSelfHosted = config.selfHosted;
const originalGrace = config.deletionGracePeriodDays;

beforeEach(async () => {
  resetEeHooks();
  Object.assign(config, {
    selfHosted: originalSelfHosted,
    deletionGracePeriodDays: originalGrace,
  });
  // Clean up leftover state from prior tests so cleanupDeletedUsers only
  // sees rows our test created.
  await query(`DELETE FROM users WHERE email LIKE '%@test.local'`, []);
});

afterEach(() => {
  resetEeHooks();
  Object.assign(config, {
    selfHosted: originalSelfHosted,
    deletionGracePeriodDays: originalGrace,
  });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// E2E lifecycle scenarios
// ---------------------------------------------------------------------------

describe('account deletion E2E (cloud)', () => {
  it('cancel sub -> soft-delete -> recover -> re-request -> hard-delete fires completion email', async () => {
    Object.assign(config, { selfHosted: false, deletionGracePeriodDays: 30 });

    const cancelSpy = vi.fn(async () => ({
      cancelled: true,
      hadActiveSubscription: true,
      refundAmountCents: 0,
    }));
    const notifyScheduledSpy = vi.fn(async () => undefined);
    const notifyRecoveredSpy = vi.fn(async () => undefined);
    const notifyCompletedSpy = vi.fn(async () => undefined);
    const deleteBillingCustomerSpy = vi.fn(async () => undefined);
    const onHardDeleteUserSpy = vi.fn(async () => undefined);

    registerEeHooks({
      cancelSubscription: cancelSpy,
      notifyDeletionScheduled: notifyScheduledSpy,
      notifyDeletionRecovered: notifyRecoveredSpy,
      notifyDeletionCompleted: notifyCompletedSpy,
      deleteBillingCustomer: deleteBillingCustomerSpy,
      onHardDeleteUser: onHardDeleteUserSpy,
    });

    const userId = await createUserDirect({ email: 'user@test.local' });

    // STEP 1: requestDeletion -> cancellation called, soft-deleted
    const result1 = await requestDeletion({ userId, refundPolicy: 'prorated' });
    expect(cancelSpy).toHaveBeenCalledWith({ userId, refundPolicy: 'prorated' });
    expect(result1.scheduledAt).toBeTruthy();
    expect(result1.cancellation?.cancelled).toBe(true);

    // notifyScheduledSpy is fire-and-forget; let it settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(notifyScheduledSpy).toHaveBeenCalled();

    let user = await queryOne<{
      deletion_requested_at: string | null;
      deletion_scheduled_at: string | null;
    }>(
      'SELECT deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1',
      [userId],
    );
    expect(user.deletion_requested_at).not.toBeNull();
    expect(user.deletion_scheduled_at).not.toBeNull();

    // STEP 2: recoverDeletion -> fields cleared, recovery email fired
    await recoverDeletion(userId);
    user = await queryOne(
      'SELECT deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1',
      [userId],
    );
    expect(user.deletion_requested_at).toBeNull();
    expect(user.deletion_scheduled_at).toBeNull();

    await new Promise((r) => setTimeout(r, 10));
    expect(notifyRecoveredSpy).toHaveBeenCalledWith(
      userId,
      'user@test.local',
      expect.any(String),
    );

    // STEP 3: requestDeletion again -> cancellation called AGAIN, soft-deleted
    cancelSpy.mockClear();
    notifyScheduledSpy.mockClear();
    const result2 = await requestDeletion({ userId, refundPolicy: 'none' });
    expect(cancelSpy).toHaveBeenCalledWith({ userId, refundPolicy: 'none' });
    expect(result2.scheduledAt).toBeTruthy();

    // STEP 4: fast-forward past grace
    await query(`UPDATE users SET deletion_scheduled_at = $1 WHERE id = $2`, [
      new Date(Date.now() - 1000).toISOString(),
      userId,
    ]);

    // STEP 5: cleanupDeletedUsers runs -> user gone, hooks fired
    await cleanupDeletedUsers();

    const finalCheck = await query('SELECT * FROM users WHERE id = $1', [userId]);
    expect(finalCheck.rows).toHaveLength(0);

    expect(onHardDeleteUserSpy).toHaveBeenCalled();

    // billing + completion notifications are fire-and-forget; let them settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(deleteBillingCustomerSpy).toHaveBeenCalledWith(userId);
    expect(notifyCompletedSpy).toHaveBeenCalledWith(
      userId,
      'user@test.local',
      expect.any(String),
    );
  });

  it('aborts when subscription cancellation fails (cloud)', async () => {
    Object.assign(config, { selfHosted: false, deletionGracePeriodDays: 30 });

    const cancelSpy = vi.fn(async () => ({
      cancelled: false,
      hadActiveSubscription: true,
      reason: 'stripe_failure_test',
    }));
    registerEeHooks({ cancelSubscription: cancelSpy });

    const userId = await createUserDirect();

    await expect(requestDeletion({ userId, refundPolicy: 'none' })).rejects.toThrow(
      /Subscription cancellation failed/,
    );

    // Verify NO state mutation
    const user = await queryOne<{
      deletion_requested_at: string | null;
      deleted_at: string | null;
    }>(
      'SELECT deletion_requested_at, deleted_at FROM users WHERE id = $1',
      [userId],
    );
    expect(user.deletion_requested_at).toBeNull();
    expect(user.deleted_at).toBeNull();
  });

  it('self-host path skips cancellation but completes the rest of the lifecycle', async () => {
    Object.assign(config, { selfHosted: true, deletionGracePeriodDays: 30 });

    const cancelSpy = vi.fn(); // should NOT be called
    const notifyCompletedSpy = vi.fn(async () => undefined);
    registerEeHooks({
      cancelSubscription: cancelSpy as never,
      notifyDeletionCompleted: notifyCompletedSpy,
    });

    const userId = await createUserDirect({ email: 'self@test.local' });

    await requestDeletion({ userId, refundPolicy: 'none' });
    expect(cancelSpy).not.toHaveBeenCalled();

    await query(`UPDATE users SET deletion_scheduled_at = $1 WHERE id = $2`, [
      new Date(Date.now() - 1000).toISOString(),
      userId,
    ]);

    await cleanupDeletedUsers();

    const finalCheck = await query('SELECT * FROM users WHERE id = $1', [userId]);
    expect(finalCheck.rows).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 10));
    expect(notifyCompletedSpy).toHaveBeenCalled();
  });
});
