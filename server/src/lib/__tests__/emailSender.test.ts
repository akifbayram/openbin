import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { query } from '../../db.js';
import type { DowngradeImpact } from '../../ee/emailTemplates.js';
import {
  fireDowngradeImpactEmail,
  fireExploreFeaturesEmail,
  firePostTrialEarlyEmail,
  firePostTrialLateEmail,
  fireSubscriptionConfirmedEmail,
  fireSubscriptionExpiredEmail,
  fireSubscriptionExpiringEmail,
  fireTrialExpiredEmail,
  fireTrialExpiringEmail,
} from '../../ee/lifecycleEmails.js';
import { sendEmail } from '../email.js';
import {
  firePasswordResetEmail,
  fireWelcomeEmail,
} from '../emailSender.js';
import { Plan } from '../planGate.js';

const mockSendEmail = vi.mocked(sendEmail);

const USER_ID = 'test-email-user-1';
const EMAIL = 'test@example.com';

async function insertUser(id: string): Promise<void> {
  await query(
    `INSERT INTO users (id, email, display_name, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [id, `user_${id}@test.local`, 'Test User', 'hash'],
  );
}

describe('emailSender', () => {
  beforeEach(async () => {
    mockSendEmail.mockClear();
    await insertUser(USER_ID);
  });

  it('firePasswordResetEmail calls sendEmail with correct subject', async () => {
    firePasswordResetEmail(USER_ID, EMAIL, 'Test User', 'https://example.com/reset');
    // safeSend is async fire-and-forget, give it a tick
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
    expect(mockSendEmail.mock.calls[0][1]).toContain('password');
  });

  it('fireSubscriptionConfirmedEmail calls sendEmail', async () => {
    fireSubscriptionConfirmedEmail(USER_ID, EMAIL, 'Test User', Plan.PRO, '2026-12-31');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('dedup: same email type for same user sends only once', async () => {
    fireTrialExpiringEmail(USER_ID, EMAIL, 'Test User', '2026-04-01');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));

    fireTrialExpiringEmail(USER_ID, EMAIL, 'Test User', '2026-04-01');
    // Allow time for the second attempt to complete (it should be deduped)
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('SKIP_DEDUP: firePasswordResetEmail sends every time', async () => {
    firePasswordResetEmail(USER_ID, EMAIL, 'Test User', 'https://example.com/reset1');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));

    firePasswordResetEmail(USER_ID, EMAIL, 'Test User', 'https://example.com/reset2');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(2));
  });

  it('different email types for same user are not deduped', async () => {
    fireTrialExpiringEmail(USER_ID, EMAIL, 'Test User', '2026-04-01');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));

    fireTrialExpiredEmail(USER_ID, EMAIL, 'Test User');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(2));

    fireExploreFeaturesEmail(USER_ID, EMAIL, 'Test User');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(3));
  });

  it('fireSubscriptionExpiredEmail calls sendEmail', async () => {
    fireSubscriptionExpiredEmail(USER_ID, EMAIL, 'Test User');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('fireSubscriptionExpiringEmail calls sendEmail', async () => {
    fireSubscriptionExpiringEmail(USER_ID, EMAIL, 'Test User', '2026-12-01');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('firePostTrialEarlyEmail calls sendEmail', async () => {
    firePostTrialEarlyEmail(USER_ID, EMAIL, 'Test User');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('firePostTrialLateEmail calls sendEmail', async () => {
    firePostTrialLateEmail(USER_ID, EMAIL, 'Test User');
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('fireDowngradeImpactEmail calls sendEmail', async () => {
    const impact: DowngradeImpact = {
      locationCount: 5,
      maxLocations: 3,
      photoStorageMb: 200,
      maxPhotoStorageMb: 100,
      overLimitMembers: [{ locationName: 'Home', memberCount: 10 }],
      maxMembersPerLocation: 5,
    };
    fireDowngradeImpactEmail(USER_ID, EMAIL, 'Test User', impact);
    await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledTimes(1));
    expect(mockSendEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it('fireWelcomeEmail does not call sendEmail when selfHosted and email disabled', async () => {
    fireWelcomeEmail(USER_ID, EMAIL, 'Test User');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('safeSend swallows errors from sendEmail', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP failure'));

    // Should not throw
    fireSubscriptionConfirmedEmail(USER_ID, EMAIL, 'Test User', Plan.PRO, null);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
