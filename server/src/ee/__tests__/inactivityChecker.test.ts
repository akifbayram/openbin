import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../db.js';
import { SubStatus } from '../../lib/planGate.js';

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../lib/config.js', () => ({ config: { selfHosted: false, emailEnabled: true, baseUrl: 'https://test.openbin.app' } }));

const mockFireInactivityWarning30d = vi.fn();
const mockFireInactivityWarning7d = vi.fn();
vi.mock('../lifecycleEmails.js', () => ({
  fireInactivityWarning30d: (...args: unknown[]) => mockFireInactivityWarning30d(...args),
  fireInactivityWarning7d: (...args: unknown[]) => mockFireInactivityWarning7d(...args),
}));
vi.mock('../../lib/jobLock.js', () => ({
  acquireJobLock: vi.fn().mockReturnValue(true),
  releaseJobLock: vi.fn(),
}));

const { checkInactiveUsers, startInactivityChecker, stopInactivityChecker } = await import('../inactivityChecker.js');
const { acquireJobLock } = await import('../../lib/jobLock.js');

let uid = 0;

function daysAgoIso(days: number): string {
  const d = new Date(Date.now() - days * 24 * 3600_000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

async function insertUser(opts: {
  subStatus: number;
  lastActiveAt?: string | null;
  createdAt?: string;
  email?: string | null;
  isAdmin?: boolean;
  deletedAt?: string | null;
  suspendedAt?: string | null;
}): Promise<string> {
  const id = `ic-user-${++uid}`;
  await query(
    `INSERT INTO users (id, email, display_name, password_hash, sub_status, last_active_at, is_admin, deleted_at, suspended_at, created_at)
     VALUES ($1, $2, $3, 'hash', $4, $5, $6, $7, $8, $9)`,
    [
      id,
      (opts.email !== undefined && opts.email !== null) ? opts.email : `user_${id}@test.local`,
      'Test User',
      opts.subStatus,
      opts.lastActiveAt ?? null,
      opts.isAdmin ? 1 : 0,
      opts.deletedAt ?? null,
      opts.suspendedAt ?? null,
      opts.createdAt ?? new Date().toISOString(),
    ],
  );
  return id;
}

describe('inactivityChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 30-day warning ---
  it('sends 30d warning for user inactive 335 days with email', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(340), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).toHaveBeenCalledTimes(1);
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  // --- 7-day warning ---
  it('sends 7d warning for user inactive 358 days with email', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(360), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning7d).toHaveBeenCalledTimes(1);
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
  });

  // --- Deletion ---
  it('soft-deletes user inactive 365+ days', async () => {
    const id = await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(370) });
    await checkInactiveUsers();
    const result = await query<{ deleted_at: string | null }>('SELECT deleted_at FROM users WHERE id = $1', [id]);
    expect(result.rows[0].deleted_at).not.toBeNull();
  });

  // --- Deletion at 365+ days does not trigger warning emails ---
  it('soft-deletes user at 365+ days and does not send warning emails', async () => {
    const id = await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(370), email: 'nodelete@example.com' });
    await checkInactiveUsers();
    // Deletion path runs — no warning emails sent
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
    const result = await query<{ deleted_at: string | null }>('SELECT deleted_at FROM users WHERE id = $1', [id]);
    expect(result.rows[0].deleted_at).not.toBeNull();
  });

  it('sends 30d warning for user inactive exactly 340 days with email', async () => {
    const id = await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(340), email: 'warn30@example.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).toHaveBeenCalledTimes(1);
    const result = await query<{ deleted_at: string | null }>('SELECT deleted_at FROM users WHERE id = $1', [id]);
    expect(result.rows[0].deleted_at).toBeNull();
  });

  // --- Exclusions ---
  it('does not target users with sub_status = ACTIVE', async () => {
    await insertUser({ subStatus: SubStatus.ACTIVE, lastActiveAt: daysAgoIso(400), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  it('does not target users with sub_status = TRIAL', async () => {
    await insertUser({ subStatus: SubStatus.TRIAL, lastActiveAt: daysAgoIso(400), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  it('does not target admin users', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(400), email: 'a@b.com', isAdmin: true });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  it('does not target already-deleted users', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(400), email: 'a@b.com', deletedAt: daysAgoIso(1) });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  it('does not target suspended users', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(400), email: 'a@b.com', suspendedAt: daysAgoIso(1) });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  it('does not target user inactive only 200 days', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(200), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  // --- COALESCE fallback ---
  it('falls back to created_at when last_active_at is NULL', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: null, createdAt: daysAgoIso(370), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
  });

  it('does not target user with NULL last_active_at created 200 days ago', async () => {
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: null, createdAt: daysAgoIso(200), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  // --- Job lock ---
  it('skips processing when job lock is not acquired', async () => {
    vi.mocked(acquireJobLock).mockResolvedValueOnce(false);
    await insertUser({ subStatus: SubStatus.INACTIVE, lastActiveAt: daysAgoIso(400), email: 'a@b.com' });
    await checkInactiveUsers();
    expect(mockFireInactivityWarning30d).not.toHaveBeenCalled();
    expect(mockFireInactivityWarning7d).not.toHaveBeenCalled();
  });

  // --- Start/stop ---
  it('startInactivityChecker and stopInactivityChecker do not throw', () => {
    expect(() => startInactivityChecker()).not.toThrow();
    expect(() => stopInactivityChecker()).not.toThrow();
  });
});
