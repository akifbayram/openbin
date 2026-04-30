import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxQueryFn } from '../../db/types.js';
import { generateUuid, query } from '../../db.js';
import { registerEeHooks } from '../eeHooks.js';
import { hardDeleteUser } from '../userCleanup.js';

// ---------------------------------------------------------------------------
// Helpers — direct DB inserts so we don't depend on app routes/hooks.
// Mirrors the pattern in accountDeletion.test.ts.
// ---------------------------------------------------------------------------

interface CreateUserOpts {
  email?: string;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
}

async function createUserDirect(opts: CreateUserOpts = {}): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO users (id, email, password_hash, display_name,
       deletion_scheduled_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      opts.email ?? `u${id.slice(0, 8)}@test.local`,
      'hash',
      'Test User',
      opts.deletionScheduledAt ?? null,
      opts.deletedAt ?? null,
    ],
  );
  return id;
}

async function createLocationDirect(createdBy: string, name = 'Loc'): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO locations (id, name, created_by, invite_code)
     VALUES ($1, $2, $3, $4)`,
    [id, name, createdBy, id.slice(0, 8)],
  );
  return id;
}

async function addMemberDirect(locationId: string, userId: string, role = 'admin'): Promise<void> {
  await query(
    `INSERT INTO location_members (id, location_id, user_id, role)
     VALUES ($1, $2, $3, $4)`,
    [generateUuid(), locationId, userId, role],
  );
}

async function createBinDirect(locationId: string, createdBy: string): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO bins (id, short_code, location_id, name, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, id.slice(0, 6), locationId, 'B', createdBy],
  );
  return id;
}

async function createPhotoDirect(binId: string, createdBy: string): Promise<string> {
  const id = generateUuid();
  await query(
    `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, binId, `photo-${id}.jpg`, 'image/jpeg', 1, `/tmp/photo-${id}.jpg`, createdBy],
  );
  return id;
}

async function userExists(userId: string): Promise<boolean> {
  const r = await query('SELECT id FROM users WHERE id = $1', [userId]);
  return r.rows.length > 0;
}

async function locationExists(locationId: string): Promise<boolean> {
  const r = await query('SELECT id FROM locations WHERE id = $1', [locationId]);
  return r.rows.length > 0;
}

async function binCountFor(userId: string): Promise<number> {
  const r = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1', [userId]);
  return Number(r.rows[0].cnt);
}

async function photoCountFor(userId: string): Promise<number> {
  const r = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM photos WHERE created_by = $1', [userId]);
  return Number(r.rows[0].cnt);
}

async function memberCountFor(userId: string): Promise<number> {
  const r = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM location_members WHERE user_id = $1', [userId]);
  return Number(r.rows[0].cnt);
}

// ---------------------------------------------------------------------------
// Hook reset between tests (otherwise our spy leaks across the file).
// ---------------------------------------------------------------------------

beforeEach(() => {
  registerEeHooks({
    onHardDeleteUser: undefined as never,
    deleteBillingCustomer: undefined as never,
    notifyDeletionCompleted: undefined as never,
  });
});

afterEach(() => {
  registerEeHooks({
    onHardDeleteUser: undefined as never,
    deleteBillingCustomer: undefined as never,
    notifyDeletionCompleted: undefined as never,
  });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// hardDeleteUser
// ---------------------------------------------------------------------------

describe('hardDeleteUser', () => {
  it('removes the user, their photos, bins, location_members, and orphan-owned locations', async () => {
    const userId = await createUserDirect();
    const locId = await createLocationDirect(userId, 'Solo');
    await addMemberDirect(locId, userId);
    const binId = await createBinDirect(locId, userId);
    await createPhotoDirect(binId, userId);

    expect(await userExists(userId)).toBe(true);
    expect(await locationExists(locId)).toBe(true);
    expect(await binCountFor(userId)).toBe(1);
    expect(await photoCountFor(userId)).toBe(1);
    expect(await memberCountFor(userId)).toBe(1);

    await hardDeleteUser(userId);

    expect(await userExists(userId)).toBe(false);
    expect(await locationExists(locId)).toBe(false);
    expect(await binCountFor(userId)).toBe(0);
    expect(await photoCountFor(userId)).toBe(0);
    expect(await memberCountFor(userId)).toBe(0);
  });

  it('preserves owned locations that still have other members', async () => {
    const owner = await createUserDirect({ email: 'owner@test.local' });
    const friend = await createUserDirect({ email: 'friend@test.local' });
    const locId = await createLocationDirect(owner, 'Shared');
    await addMemberDirect(locId, owner);
    await addMemberDirect(locId, friend);

    await hardDeleteUser(owner);

    // Owner is gone, but the location lives on for the remaining member.
    expect(await userExists(owner)).toBe(false);
    expect(await locationExists(locId)).toBe(true);

    // Friend is still a member.
    const friendMembers = await query(
      'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
      [locId, friend],
    );
    expect(friendMembers.rows).toHaveLength(1);

    // FK clears the surviving location's created_by to NULL since it
    // referenced the now-deleted owner row.
    const loc = await query<{ created_by: string | null }>(
      'SELECT created_by FROM locations WHERE id = $1',
      [locId],
    );
    expect(loc.rows[0].created_by).toBeNull();
  });

  it('hard-deletes user even when they have attachments and shopping list items', async () => {
    // The owner is who we delete. The friend owns the bin so it (and its
    // attachment) survive — letting us assert that the FK SET NULL clauses
    // on attachments.created_by / shopping_list_items.created_by both fired.
    const friend = await createUserDirect({ email: 'friend-owner@test.local' });
    const userId = await createUserDirect();
    const locId = await createLocationDirect(friend, 'Loc');
    await addMemberDirect(locId, friend);
    await addMemberDirect(locId, userId, 'member');
    const binId = await createBinDirect(locId, friend);

    // Attachment uploaded by the user-being-deleted, against friend's bin.
    await query(
      `INSERT INTO attachments (id, bin_id, filename, mime_type, size, storage_path, created_by)
       VALUES ($1, $2, 'a.pdf', 'application/pdf', 100, '/tmp/a.pdf', $3)`,
      [generateUuid(), binId, userId],
    );

    // Shopping list entry created by the user-being-deleted.
    await query(
      `INSERT INTO shopping_list_items (id, location_id, name, created_by)
       VALUES ($1, $2, 'milk', $3)`,
      [generateUuid(), locId, userId],
    );

    await hardDeleteUser(userId);

    // User row gone — the FK no longer blocks the delete.
    expect(await userExists(userId)).toBe(false);

    // Attachment preserved with NULL created_by (SET NULL on FK).
    const attachCheck = await query<{ created_by: string | null }>(
      'SELECT created_by FROM attachments WHERE bin_id = $1',
      [binId],
    );
    expect(attachCheck.rows).toHaveLength(1);
    expect(attachCheck.rows[0].created_by).toBeNull();

    // Shopping list item preserved with NULL created_by.
    const shopCheck = await query<{ created_by: string | null }>(
      'SELECT created_by FROM shopping_list_items WHERE location_id = $1',
      [locId],
    );
    expect(shopCheck.rows).toHaveLength(1);
    expect(shopCheck.rows[0].created_by).toBeNull();
  });

  it('invokes the onHardDeleteUser hook inside the transaction with the right userId', async () => {
    const userId = await createUserDirect();

    const onHardDeleteUser = vi.fn(async (_tx: TxQueryFn, _id: string) => undefined);
    registerEeHooks({ onHardDeleteUser });

    await hardDeleteUser(userId);

    expect(onHardDeleteUser).toHaveBeenCalledTimes(1);
    expect(onHardDeleteUser.mock.calls[0][1]).toBe(userId);
    // First arg should be a callable transactional query fn.
    expect(typeof onHardDeleteUser.mock.calls[0][0]).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// cleanupDeletedUsers — exercised indirectly via the public sweep function.
// We import it dynamically so the cron interval handle never starts.
// ---------------------------------------------------------------------------

describe('cleanupDeletedUsers (sweep)', () => {
  it('hard-deletes users whose deletion_scheduled_at <= now()', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const userId = await createUserDirect({ deletionScheduledAt: past });

    const { cleanupDeletedUsers } = await import('../userCleanup.js');
    await cleanupDeletedUsers();

    expect(await userExists(userId)).toBe(false);
  });

  it('skips users whose deletion_scheduled_at is in the future', async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const userId = await createUserDirect({ deletionScheduledAt: future });

    const { cleanupDeletedUsers } = await import('../userCleanup.js');
    await cleanupDeletedUsers();

    expect(await userExists(userId)).toBe(true);
  });

  it('skips users with deletion_scheduled_at IS NULL', async () => {
    const userId = await createUserDirect({ deletionScheduledAt: null });

    const { cleanupDeletedUsers } = await import('../userCleanup.js');
    await cleanupDeletedUsers();

    expect(await userExists(userId)).toBe(true);
  });

  it('fires notifyDeletionCompleted hook with email captured before delete', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const userId = await createUserDirect({
      email: 'gone@test.local',
      deletionScheduledAt: past,
    });

    const notifyHook = vi.fn(async () => undefined);
    registerEeHooks({ notifyDeletionCompleted: notifyHook });

    const { cleanupDeletedUsers } = await import('../userCleanup.js');
    await cleanupDeletedUsers();

    expect(await userExists(userId)).toBe(false);
    // Fire-and-forget; let it settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(notifyHook).toHaveBeenCalledTimes(1);
    expect(notifyHook).toHaveBeenCalledWith(userId, 'gone@test.local', 'Test User');
  });
});
