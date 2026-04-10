import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../db.js';
import { SubStatus } from '../../lib/planGate.js';

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../lib/config.js', () => ({ config: { selfHosted: true, emailEnabled: false } }));
vi.mock('../lifecycleEmails.js', () => ({
  fireTrialExpiringEmail: vi.fn(),
  fireSubscriptionExpiringEmail: vi.fn(),
  fireTrialExpiredEmail: vi.fn(),
  fireExploreFeaturesEmail: vi.fn(),
  firePostTrialEarlyEmail: vi.fn(),
  firePostTrialLateEmail: vi.fn(),
}));
vi.mock('../../lib/jobLock.js', () => ({
  acquireJobLock: vi.fn().mockReturnValue(true),
  releaseJobLock: vi.fn(),
}));

const { startTrialChecker, stopTrialChecker } = await import('../trialChecker.js');

let uid = 0;

async function insertUser(opts: {
  subStatus: number;
  activeUntil?: string | null;
  email?: string | null;
  createdAt?: string;
}): Promise<string> {
  const id = `tc-user-${++uid}`;
  await query(
    `INSERT INTO users (id, email, display_name, password_hash, sub_status, active_until, created_at)
     VALUES ($1, $2, $3, 'hash', $4, $5, $6)`,
    [
      id,
      (opts.email !== undefined && opts.email !== null) ? opts.email : `user_${id}@test.local`,
      'Test User',
      opts.subStatus,
      opts.activeUntil ?? null,
      opts.createdAt ?? new Date().toISOString(),
    ],
  );
  return id;
}

function hoursFromNow(hours: number): string {
  const d = new Date(Date.now() + hours * 3600_000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function daysFromNow(days: number): string {
  return hoursFromNow(days * 24);
}

describe('trialChecker', () => {
  it('startTrialChecker is a no-op in self-hosted mode', () => {
    expect(() => startTrialChecker()).not.toThrow();
  });

  it('stopTrialChecker is safe to call without starting', () => {
    expect(() => stopTrialChecker()).not.toThrow();
  });
});

describe('trialChecker queries', () => {
  beforeEach(async () => {
    await query("DELETE FROM users WHERE id LIKE 'tc-user-%'", []);
  });

  // --- Trial expiring (sub_status=TRIAL, active_until within 3 days) ---

  it('trial expiring query finds user with active_until 2 days from now', async () => {
    const id = await insertUser({ subStatus: SubStatus.TRIAL, activeUntil: daysFromNow(2), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });

  it('trial expiring query does NOT find user with active_until 5 days from now', async () => {
    const id = await insertUser({ subStatus: SubStatus.TRIAL, activeUntil: daysFromNow(5), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    expect(result.rows.map((r) => r.id)).not.toContain(id);
  });

  // --- Trial expired (sub_status=TRIAL, active_until in the past) ---

  it('trial expired query finds user with active_until in the past', async () => {
    const id = await insertUser({ subStatus: SubStatus.TRIAL, activeUntil: daysFromNow(-1), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });

  it('trial expired query does NOT find user with active_until in the future', async () => {
    const id = await insertUser({ subStatus: SubStatus.TRIAL, activeUntil: daysFromNow(2), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    expect(result.rows.map((r) => r.id)).not.toContain(id);
  });

  // --- Subscription expiring (sub_status=ACTIVE, active_until within 3 days) ---

  it('subscription expiring query finds active user expiring in 2 days', async () => {
    const id = await insertUser({ subStatus: SubStatus.ACTIVE, activeUntil: daysFromNow(2), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.ACTIVE],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });

  // --- Post-trial early (INACTIVE, active_until between -3 and -2 days ago) ---

  it('post-trial early finds inactive user whose trial expired 2.5 days ago', async () => {
    const id = await insertUser({ subStatus: SubStatus.INACTIVE, activeUntil: daysFromNow(-2.5), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now', '-2 days')
       AND active_until > datetime('now', '-3 days')
       AND email IS NOT NULL`,
      [SubStatus.INACTIVE],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });

  // --- Post-trial late (INACTIVE, active_until between -8 and -7 days ago) ---

  it('post-trial late finds inactive user whose trial expired 7.5 days ago', async () => {
    const id = await insertUser({ subStatus: SubStatus.INACTIVE, activeUntil: daysFromNow(-7.5), email: 'a@b.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now', '-7 days')
       AND active_until > datetime('now', '-8 days')
       AND email IS NOT NULL`,
      [SubStatus.INACTIVE],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });

  // --- Email is always present (NOT NULL) — verify query still works ---

  it('trial expiring query includes users with email (email is always present)', async () => {
    const id = await insertUser({ subStatus: SubStatus.TRIAL, activeUntil: daysFromNow(2), email: 'trialtest@example.com' });
    const result = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    expect(result.rows.map((r) => r.id)).toContain(id);
  });
});
