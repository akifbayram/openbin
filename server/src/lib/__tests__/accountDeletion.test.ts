import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUuid, query } from '../../db.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../httpErrors.js';

// We mock config so we can flip selfHosted on a per-test basis. Spreading the
// real config (rather than constructing a fake) keeps unrelated knobs in sync
// with config.ts and matches the pattern used in restore.test.ts.
vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: { ...original.config },
  };
});

// Subject under test
import { recoverDeletion, requestDeletion } from '../accountDeletion.js';
import { config } from '../config.js';
import { registerEeHooks } from '../eeHooks.js';
import { hashToken } from '../refreshTokens.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CreateUserOpts {
  email?: string;
  isAdmin?: boolean;
  deletionRequestedAt?: string | null;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
}

async function createUserDirect(opts: CreateUserOpts = {}): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO users (id, email, password_hash, display_name, is_admin,
       deletion_requested_at, deletion_scheduled_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      opts.email ?? `u${id.slice(0, 8)}@test.local`,
      'hash',
      'Test User',
      opts.isAdmin ? 1 : 0,
      opts.deletionRequestedAt ?? null,
      opts.deletionScheduledAt ?? null,
      opts.deletedAt ?? null,
    ],
  );
  return id;
}

async function getUserRow(userId: string): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT id, email, deleted_at, deletion_requested_at, deletion_scheduled_at, deletion_reason
     FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function insertRefreshToken(userId: string): Promise<string> {
  const id = generateUuid();
  const familyId = generateUuid();
  const raw = `refresh-${id}`;
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, familyId, expiresAt],
  );
  return id;
}

async function getRefreshTokenRevokedAt(tokenId: string): Promise<string | null> {
  const result = await query<{ revoked_at: string | null }>(
    'SELECT revoked_at FROM refresh_tokens WHERE id = $1',
    [tokenId],
  );
  return result.rows[0]?.revoked_at ?? null;
}

// ---------------------------------------------------------------------------
// Reset hook + config state between tests so cloud cases don't leak
// ---------------------------------------------------------------------------

const originalSelfHosted = config.selfHosted;
const originalGrace = config.deletionGracePeriodDays;

beforeEach(() => {
  // Reset eeHooks by registering empty no-ops over any keys we touch.
  registerEeHooks({
    cancelSubscription: undefined as never,
    notifyDeletionScheduled: undefined as never,
  });
  // Restore baseline config
  Object.assign(config, {
    selfHosted: originalSelfHosted,
    deletionGracePeriodDays: originalGrace,
  });
});

afterEach(() => {
  registerEeHooks({
    cancelSubscription: undefined as never,
    notifyDeletionScheduled: undefined as never,
  });
  Object.assign(config, {
    selfHosted: originalSelfHosted,
    deletionGracePeriodDays: originalGrace,
  });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// requestDeletion
// ---------------------------------------------------------------------------

describe('requestDeletion (self-hosted)', () => {
  beforeEach(() => {
    Object.assign(config, { selfHosted: true, deletionGracePeriodDays: 30 });
  });

  it('soft-deletes user, schedules ~30 days out, revokes refresh tokens, sets deletion_reason=user_initiated', async () => {
    const userId = await createUserDirect();
    const tokenId = await insertRefreshToken(userId);

    const before = Date.now();
    const result = await requestDeletion({ userId, refundPolicy: 'none' });
    const after = Date.now();

    expect(result.scheduledAt).not.toBeNull();
    const scheduledMs = new Date(result.scheduledAt!).getTime();
    // ~30 days out, allow a generous range for clock skew
    const expectedLow = before + 29 * 24 * 3600 * 1000;
    const expectedHigh = after + 31 * 24 * 3600 * 1000;
    expect(scheduledMs).toBeGreaterThanOrEqual(expectedLow);
    expect(scheduledMs).toBeLessThanOrEqual(expectedHigh);

    const row = await getUserRow(userId);
    expect(row).not.toBeNull();
    expect(row?.deletion_requested_at).not.toBeNull();
    expect(row?.deletion_scheduled_at).toBe(result.scheduledAt);
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.deletion_reason).toBe('user_initiated');

    expect(await getRefreshTokenRevokedAt(tokenId)).not.toBeNull();
  });

  it('sets deletion_reason=admin_initiated when initiatedByAdminId is provided', async () => {
    const adminId = await createUserDirect({ isAdmin: true, email: 'admin@test.local' });
    const userId = await createUserDirect({ email: 'victim@test.local' });

    await requestDeletion({
      userId,
      refundPolicy: 'none',
      initiatedByAdminId: adminId,
      initiatedByAdminName: 'admin@test.local',
    });

    const row = await getUserRow(userId);
    expect(row?.deletion_reason).toBe('admin_initiated');
  });

  it('throws ConflictError if user already has deletion_requested_at set', async () => {
    const userId = await createUserDirect({
      deletionRequestedAt: new Date().toISOString(),
    });

    await expect(requestDeletion({ userId, refundPolicy: 'none' }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ForbiddenError when user is the only non-pending admin', async () => {
    const onlyAdmin = await createUserDirect({ isAdmin: true, email: 'only-admin@test.local' });
    // Add another admin who is already pending deletion (does not count)
    await createUserDirect({
      isAdmin: true,
      email: 'pending-admin@test.local',
      deletionRequestedAt: new Date().toISOString(),
    });

    await expect(requestDeletion({ userId: onlyAdmin, refundPolicy: 'none' }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows admin deletion when there are other non-pending admins', async () => {
    const adminA = await createUserDirect({ isAdmin: true, email: 'a@test.local' });
    await createUserDirect({ isAdmin: true, email: 'b@test.local' });

    const result = await requestDeletion({ userId: adminA, refundPolicy: 'none' });
    expect(result.scheduledAt).not.toBeNull();

    const row = await getUserRow(adminA);
    expect(row?.deletion_requested_at).not.toBeNull();
  });

  it('throws NotFoundError when the user does not exist', async () => {
    await expect(requestDeletion({ userId: 'nonexistent', refundPolicy: 'none' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  // Skipped pending Task 1.2 (userCleanup hardDeleteUser implementation)
  it.skip('grace=0 immediately hard-deletes (Task 1.2)', async () => {
    Object.assign(config, { deletionGracePeriodDays: 0 });
    const userId = await createUserDirect();
    await requestDeletion({ userId, refundPolicy: 'none' });
    const row = await getUserRow(userId);
    expect(row).toBeNull();
  });
});

describe('requestDeletion (cloud / EE hooks)', () => {
  beforeEach(() => {
    Object.assign(config, { selfHosted: false, deletionGracePeriodDays: 30 });
  });

  it('throws ConflictError and does not modify the user when cancelSubscription returns cancelled=false with hadActiveSubscription=true', async () => {
    const userId = await createUserDirect();

    registerEeHooks({
      cancelSubscription: vi.fn(async () => ({
        cancelled: false,
        hadActiveSubscription: true,
        reason: 'stripe_unreachable',
      })),
    });

    await expect(requestDeletion({ userId, refundPolicy: 'none' }))
      .rejects.toBeInstanceOf(ConflictError);

    const row = await getUserRow(userId);
    expect(row?.deletion_requested_at).toBeNull();
    expect(row?.deleted_at).toBeNull();
    expect(row?.deletion_scheduled_at).toBeNull();
  });

  it('proceeds with soft-delete when cancelSubscription returns cancelled=true with hadActiveSubscription=true and exposes refundAmountCents', async () => {
    const userId = await createUserDirect();

    const cancelMock = vi.fn(async () => ({
      cancelled: true,
      hadActiveSubscription: true,
      refundAmountCents: 1234,
    }));
    registerEeHooks({ cancelSubscription: cancelMock });

    const result = await requestDeletion({ userId, refundPolicy: 'prorated' });

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).toHaveBeenCalledWith({ userId, refundPolicy: 'prorated' });

    expect(result.cancellation).toEqual({
      cancelled: true,
      hadActiveSubscription: true,
      refundAmountCents: 1234,
    });
    expect(result.scheduledAt).not.toBeNull();

    const row = await getUserRow(userId);
    expect(row?.deletion_requested_at).not.toBeNull();
    expect(row?.deleted_at).not.toBeNull();
  });

  it('proceeds (idempotent) when cancelSubscription returns cancelled=true with no active subscription', async () => {
    const userId = await createUserDirect();

    registerEeHooks({
      cancelSubscription: vi.fn(async () => ({
        cancelled: true,
        hadActiveSubscription: false,
      })),
    });

    const result = await requestDeletion({ userId, refundPolicy: 'none' });

    expect(result.cancellation).toEqual({
      cancelled: true,
      hadActiveSubscription: false,
    });
    expect(result.scheduledAt).not.toBeNull();

    const row = await getUserRow(userId);
    expect(row?.deletion_requested_at).not.toBeNull();
    expect(row?.deleted_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recoverDeletion
// ---------------------------------------------------------------------------

describe('recoverDeletion', () => {
  beforeEach(() => {
    Object.assign(config, { selfHosted: true, deletionGracePeriodDays: 30 });
  });

  it('clears deletion fields and re-enables login', async () => {
    const userId = await createUserDirect();
    await requestDeletion({ userId, refundPolicy: 'none' });

    // Sanity check: user is soft-deleted
    const before = await getUserRow(userId);
    expect(before?.deletion_requested_at).not.toBeNull();
    expect(before?.deleted_at).not.toBeNull();

    await recoverDeletion(userId);

    const after = await getUserRow(userId);
    expect(after).not.toBeNull();
    expect(after?.deletion_requested_at).toBeNull();
    expect(after?.deletion_scheduled_at).toBeNull();
    expect(after?.deleted_at).toBeNull();
    expect(after?.deletion_reason).toBeNull();
  });

  it('throws ConflictError when the user is not pending deletion', async () => {
    const userId = await createUserDirect();
    await expect(recoverDeletion(userId)).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ConflictError when the grace period has expired', async () => {
    const expiredScheduled = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const userId = await createUserDirect({
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString(),
      deletionScheduledAt: expiredScheduled,
      deletedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString(),
    });

    await expect(recoverDeletion(userId)).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when the user does not exist', async () => {
    await expect(recoverDeletion('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });
});
