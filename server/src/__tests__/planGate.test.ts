import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----

vi.mock('../lib/config.js', () => ({
  config: {
    selfHosted: true,
    managerUrl: null as string | null,
    subscriptionJwtSecret: null as string | null,
    jwtSecret: 'test-jwt-secret',
  },
}));

vi.mock('../db.js', () => ({
  query: vi.fn(),
}));

// ---- Imports (after mocks) ----

import { query } from '../db.js';
import { config } from '../lib/config.js';
import {
  checkLocationWritable,
  computeOverLimits,
  generateUpgradeUrl,
  getEffectiveMemberRole,
  getFeatureMap,
  getUserOverLimits,
  getUserPlanInfo,
  invalidateOverLimitCache,
  isPlanRestricted,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
  Plan,
  SubStatus,
} from '../lib/planGate.js';

// Helper to set config values for tests
function setConfig(overrides: Partial<typeof config>) {
  Object.assign(config, overrides);
}

describe('isSelfHosted()', () => {
  it('returns true when config.selfHosted is true', () => {
    setConfig({ selfHosted: true });
    expect(isSelfHosted()).toBe(true);
  });

  it('returns false when config.selfHosted is false', () => {
    setConfig({ selfHosted: false });
    expect(isSelfHosted()).toBe(false);
  });
});

describe('isProUser()', () => {
  it('returns true for self-hosted regardless of plan', () => {
    setConfig({ selfHosted: true });
    expect(isProUser({ plan: Plan.LITE, subStatus: SubStatus.INACTIVE })).toBe(true);
    expect(isProUser({ plan: Plan.LITE, subStatus: SubStatus.ACTIVE })).toBe(true);
  });

  it('returns true for cloud PRO + ACTIVE', () => {
    setConfig({ selfHosted: false });
    expect(isProUser({ plan: Plan.PRO, subStatus: SubStatus.ACTIVE })).toBe(true);
  });

  it('returns true for cloud PRO + TRIAL', () => {
    setConfig({ selfHosted: false });
    expect(isProUser({ plan: Plan.PRO, subStatus: SubStatus.TRIAL })).toBe(true);
  });

  it('returns false for cloud PRO + INACTIVE', () => {
    setConfig({ selfHosted: false });
    expect(isProUser({ plan: Plan.PRO, subStatus: SubStatus.INACTIVE })).toBe(false);
  });

  it('returns false for cloud LITE', () => {
    setConfig({ selfHosted: false });
    expect(isProUser({ plan: Plan.LITE, subStatus: SubStatus.ACTIVE })).toBe(false);
    expect(isProUser({ plan: Plan.LITE, subStatus: SubStatus.INACTIVE })).toBe(false);
  });
});

describe('isPlanRestricted()', () => {
  it('returns false for self-hosted regardless of plan', () => {
    setConfig({ selfHosted: true });
    expect(isPlanRestricted({ plan: Plan.LITE, subStatus: SubStatus.INACTIVE })).toBe(false);
    expect(isPlanRestricted({ plan: Plan.LITE, subStatus: SubStatus.ACTIVE })).toBe(false);
  });

  it('returns true for cloud LITE', () => {
    setConfig({ selfHosted: false });
    expect(isPlanRestricted({ plan: Plan.LITE, subStatus: SubStatus.ACTIVE })).toBe(true);
  });

  it('returns true for cloud INACTIVE subscription', () => {
    setConfig({ selfHosted: false });
    expect(isPlanRestricted({ plan: Plan.PRO, subStatus: SubStatus.INACTIVE })).toBe(true);
  });

  it('returns false for cloud PRO + ACTIVE', () => {
    setConfig({ selfHosted: false });
    expect(isPlanRestricted({ plan: Plan.PRO, subStatus: SubStatus.ACTIVE })).toBe(false);
  });

  it('returns false for cloud PRO + TRIAL', () => {
    setConfig({ selfHosted: false });
    expect(isPlanRestricted({ plan: Plan.PRO, subStatus: SubStatus.TRIAL })).toBe(false);
  });
});

describe('isSubscriptionActive()', () => {
  it('returns true for self-hosted regardless of subStatus', () => {
    setConfig({ selfHosted: true });
    expect(isSubscriptionActive({ subStatus: SubStatus.INACTIVE, activeUntil: null })).toBe(true);
  });

  it('returns false for INACTIVE subscription (cloud)', () => {
    setConfig({ selfHosted: false });
    expect(isSubscriptionActive({ subStatus: SubStatus.INACTIVE, activeUntil: null })).toBe(false);
  });

  it('returns true when activeUntil is null and status is ACTIVE (cloud)', () => {
    setConfig({ selfHosted: false });
    expect(isSubscriptionActive({ subStatus: SubStatus.ACTIVE, activeUntil: null })).toBe(true);
  });

  it('returns true when activeUntil is in the future (cloud)', () => {
    setConfig({ selfHosted: false });
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(isSubscriptionActive({ subStatus: SubStatus.ACTIVE, activeUntil: future })).toBe(true);
  });

  it('returns false when activeUntil is in the past (cloud)', () => {
    setConfig({ selfHosted: false });
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(isSubscriptionActive({ subStatus: SubStatus.ACTIVE, activeUntil: past })).toBe(false);
  });

  it('returns true when activeUntil is in the future with TRIAL status (cloud)', () => {
    setConfig({ selfHosted: false });
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(isSubscriptionActive({ subStatus: SubStatus.TRIAL, activeUntil: future })).toBe(true);
  });
});

describe('getFeatureMap()', () => {
  it('returns PRO features for PRO plan', () => {
    setConfig({ selfHosted: false });
    const features = getFeatureMap(Plan.PRO);
    expect(features.ai).toBe(true);
    expect(features.apiKeys).toBe(true);
    expect(features.customFields).toBe(true);
    expect(features.fullExport).toBe(true);
    expect(features.reorganize).toBe(true);
    expect(features.binSharing).toBe(true);
    expect(features.maxLocations).toBe(null);
    expect(features.maxPhotoStorageMb).toBe(5000);
    expect(features.maxMembersPerLocation).toBe(null);
    expect(features.activityRetentionDays).toBe(90);
  });

  it('returns LITE features for LITE plan (cloud)', () => {
    setConfig({ selfHosted: false });
    const features = getFeatureMap(Plan.LITE);
    expect(features.ai).toBe(false);
    expect(features.apiKeys).toBe(false);
    expect(features.customFields).toBe(false);
    expect(features.fullExport).toBe(false);
    expect(features.reorganize).toBe(false);
    expect(features.binSharing).toBe(false);
    expect(features.maxLocations).toBe(1);
    expect(features.maxPhotoStorageMb).toBe(100);
    expect(features.maxMembersPerLocation).toBe(1);
    expect(features.activityRetentionDays).toBe(30);
  });

  it('returns PRO features when self-hosted regardless of plan argument', () => {
    setConfig({ selfHosted: true });
    const features = getFeatureMap(Plan.LITE);
    expect(features.ai).toBe(true);
    expect(features.apiKeys).toBe(true);
    expect(features.customFields).toBe(true);
    expect(features.fullExport).toBe(true);
    expect(features.reorganize).toBe(true);
    expect(features.binSharing).toBe(true);
    expect(features.maxLocations).toBe(null);
    expect(features.maxPhotoStorageMb).toBe(null);
    expect(features.maxMembersPerLocation).toBe(null);
    expect(features.activityRetentionDays).toBe(null);
  });
});

describe('getUserPlanInfo()', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  it('returns null when user not found', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await getUserPlanInfo('nonexistent-user');
    expect(result).toBeNull();
  });

  it('returns mapped UserPlanInfo when user found', async () => {
    vi.mocked(query).mockResolvedValue({
      rows: [{ plan: Plan.PRO, sub_status: SubStatus.ACTIVE, active_until: null, email: 'user@example.com', previous_sub_status: null }],
      rowCount: 1,
    });
    const result = await getUserPlanInfo('user-id');
    expect(result).toEqual({
      plan: Plan.PRO,
      subStatus: SubStatus.ACTIVE,
      activeUntil: null,
      email: 'user@example.com',
      previousSubStatus: null,
    });
  });

  it('maps snake_case DB columns to camelCase', async () => {
    const activeUntil = '2027-01-01T00:00:00.000Z';
    vi.mocked(query).mockResolvedValue({
      rows: [{ plan: Plan.LITE, sub_status: SubStatus.TRIAL, active_until: activeUntil, email: null, previous_sub_status: SubStatus.ACTIVE }],
      rowCount: 1,
    });
    const result = await getUserPlanInfo('user-id');
    expect(result?.plan).toBe(Plan.LITE);
    expect(result?.subStatus).toBe(SubStatus.TRIAL);
    expect(result?.activeUntil).toBe(activeUntil);
    expect(result?.email).toBeNull();
    expect(result?.previousSubStatus).toBe(SubStatus.ACTIVE);
  });

  it('queries with the correct SQL and userId', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
    await getUserPlanInfo('some-user-id');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['some-user-id'],
    );
  });
});

describe('generateUpgradeUrl()', () => {
  it('returns null when managerUrl is not set', async () => {
    setConfig({ selfHosted: false, managerUrl: null });
    const url = await generateUpgradeUrl('user-id', 'user@example.com');
    expect(url).toBeNull();
  });

  it('returns a valid URL when managerUrl is set', async () => {
    setConfig({ selfHosted: false, managerUrl: 'https://manager.example.com', subscriptionJwtSecret: 'sub-secret' });
    const url = await generateUpgradeUrl('user-id', 'user@example.com');
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\/manager\.example\.com\/auth\/openbin\?token=/);
  });

  it('returns a URL with a valid JWT token', async () => {
    setConfig({ selfHosted: false, managerUrl: 'https://manager.example.com', subscriptionJwtSecret: 'sub-secret' });
    const url = await generateUpgradeUrl('user-id', 'user@example.com');
    expect(url).toBeTruthy();
    const token = url!.split('?token=')[1];
    expect(token).toBeTruthy();

    // Verify the token is a valid JWT
    const jose = await import('jose');
    const { payload: decoded } = await jose.jwtVerify(token, new TextEncoder().encode('sub-secret'));
    expect(decoded.userId).toBe('user-id');
    expect(decoded.email).toBe('user@example.com');
  });

  it('returns null when subscriptionJwtSecret is not set', async () => {
    setConfig({
      selfHosted: false,
      managerUrl: 'https://manager.example.com',
      subscriptionJwtSecret: null,
      jwtSecret: 'test-jwt-secret',
    });
    const url = await generateUpgradeUrl('user-id', null);
    expect(url).toBeNull();
  });

  it('handles null email in token', async () => {
    setConfig({ selfHosted: false, managerUrl: 'https://manager.example.com', subscriptionJwtSecret: 'sub-secret' });
    const url = await generateUpgradeUrl('user-id', null);
    expect(url).toBeTruthy();
    const token = url!.split('?token=')[1];
    const jose = await import('jose');
    const { payload: decoded } = await jose.jwtVerify(token, new TextEncoder().encode('sub-secret'));
    expect(decoded.userId).toBe('user-id');
    expect(decoded.email).toBeNull();
  });
});

describe('computeOverLimits()', () => {
  it('returns all false when under limits', () => {
    setConfig({ selfHosted: false });
    const result = computeOverLimits(
      { locationCount: 1, photoStorageMb: 50, memberCounts: { loc1: 1 } },
      { ...getFeatureMap(Plan.LITE) },
    );
    expect(result).toEqual({ locations: false, photos: false, members: [] });
  });

  it('returns locations=true when over location limit', () => {
    setConfig({ selfHosted: false });
    const result = computeOverLimits(
      { locationCount: 3, photoStorageMb: 50, memberCounts: {} },
      { ...getFeatureMap(Plan.LITE) },
    );
    expect(result.locations).toBe(true);
  });

  it('returns photos=true when over photo storage limit', () => {
    setConfig({ selfHosted: false });
    const result = computeOverLimits(
      { locationCount: 1, photoStorageMb: 200, memberCounts: {} },
      { ...getFeatureMap(Plan.LITE) },
    );
    expect(result.photos).toBe(true);
  });

  it('returns member locationIds when over member limit', () => {
    setConfig({ selfHosted: false });
    const result = computeOverLimits(
      { locationCount: 1, photoStorageMb: 50, memberCounts: { loc1: 5, loc2: 1 } },
      { ...getFeatureMap(Plan.LITE) },
    );
    expect(result.members).toEqual(['loc1']);
  });

  it('returns all false when limits are null (unlimited)', () => {
    setConfig({ selfHosted: false });
    const result = computeOverLimits(
      { locationCount: 100, photoStorageMb: 9999, memberCounts: { loc1: 999 } },
      { ...getFeatureMap(Plan.PRO), maxPhotoStorageMb: null },
    );
    expect(result).toEqual({ locations: false, photos: false, members: [] });
  });
});

describe('getUserOverLimits() with cache', () => {
  beforeEach(() => {
    setConfig({ selfHosted: false });
    invalidateOverLimitCache('user1');
    vi.mocked(query).mockReset();
  });

  it('returns empty over-limits in self-hosted mode', async () => {
    setConfig({ selfHosted: true });
    const result = await getUserOverLimits('user1');
    expect(result).toEqual({ locations: false, photos: false, members: [] });
    expect(vi.mocked(query)).not.toHaveBeenCalled();
  });

  it('computes over-limits from DB queries', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 200 * 1024 * 1024 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ location_id: 'loc1', cnt: 5 }], rowCount: 1 });
    const result = await getUserOverLimits('user1');
    expect(result.locations).toBe(true);
    expect(result.photos).toBe(true);
    expect(result.members).toEqual(['loc1']);
  });

  it('returns cached result on second call', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await getUserOverLimits('user1');
    const callCount = vi.mocked(query).mock.calls.length;
    await getUserOverLimits('user1');
    expect(vi.mocked(query).mock.calls.length).toBe(callCount);
  });
});

describe('checkLocationWritable()', () => {
  beforeEach(() => {
    setConfig({ selfHosted: false });
    invalidateOverLimitCache('owner1');
    vi.mocked(query).mockReset();
  });

  it('returns writable=true when under location limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ created_by: 'owner1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await checkLocationWritable('loc1');
    expect(result.writable).toBe(true);
  });

  it('returns writable=false when over location limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ created_by: 'owner1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await checkLocationWritable('loc1');
    expect(result.writable).toBe(false);
    expect(result.reason).toContain('location');
  });

  it('returns writable=true in self-hosted mode', async () => {
    setConfig({ selfHosted: true });
    const result = await checkLocationWritable('loc1');
    expect(result.writable).toBe(true);
  });
});

describe('getEffectiveMemberRole()', () => {
  beforeEach(() => {
    setConfig({ selfHosted: false });
    invalidateOverLimitCache('owner1');
    vi.mocked(query).mockReset();
  });

  it('returns stored role when not over member limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ location_id: 'loc1', cnt: 1 }], rowCount: 1 });
    const role = await getEffectiveMemberRole('member1', 'loc1', 'member', 'owner1');
    expect(role).toBe('member');
  });

  it('downgrades non-owner to viewer when over member limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ location_id: 'loc1', cnt: 5 }], rowCount: 1 });
    const role = await getEffectiveMemberRole('member1', 'loc1', 'admin', 'owner1');
    expect(role).toBe('viewer');
  });

  it('preserves owner role even when over member limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: Plan.LITE, sub_status: SubStatus.ACTIVE, active_until: null, email: null, previous_sub_status: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ location_id: 'loc1', cnt: 5 }], rowCount: 1 });
    const role = await getEffectiveMemberRole('owner1', 'loc1', 'admin', 'owner1');
    expect(role).toBe('admin');
  });
});
