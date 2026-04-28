import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    token: 'cookie',
  })),
}));

// Default to cloud (not self-hosted) so the provider exercises its fetch path.
// Individual tests can override isSelfHostedInstance() via mockIsSelfHosted.
const mockIsSelfHosted = vi.fn(() => false);
vi.mock('@/lib/qrConfig', () => ({
  isSelfHostedInstance: () => mockIsSelfHosted(),
  waitForConfig: () => Promise.resolve(),
}));

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PlanProvider, usePlan } from '@/lib/usePlan';
import type { PlanInfo } from '@/types';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

const MOCK_USAGE = {
  locationCount: 1,
  photoStorageMb: 10,
  memberCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};

const SELF_HOSTED_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: true,
  locked: false,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    reorganize: true,
    binSharing: true,
    attachments: true,
    maxBins: null,
    maxLocations: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
    aiCreditsPerMonth: null,
    reorganizeMaxBins: null,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

const FREE_PLAN: PlanInfo = {
  plan: 'free',
  status: 'active',
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: false,
  locked: false,
  features: {
    ai: true,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    reorganize: false,
    binSharing: false,
    attachments: false,
    maxBins: 10,
    maxLocations: 1,
    maxPhotoStorageMb: 0,
    maxMembersPerLocation: 1,
    activityRetentionDays: 7,
    aiCreditsPerMonth: 10,
    reorganizeMaxBins: null,
  },
  upgradeUrl: 'https://example.com/upgrade',
  upgradePlusUrl: 'https://example.com/auth/openbin?token=abc&plan=plus',
  upgradeProUrl: 'https://example.com/auth/openbin?token=abc&plan=pro',
  portalUrl: null,
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

const PLUS_PLAN: PlanInfo = {
  plan: 'plus',
  status: 'active',
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: false,
  locked: false,
  features: {
    ai: true,
    apiKeys: false,
    customFields: false,
    fullExport: true,
    reorganize: true,
    binSharing: false,
    attachments: false,
    maxBins: 100,
    maxLocations: 1,
    maxPhotoStorageMb: 100,
    maxMembersPerLocation: 1,
    activityRetentionDays: 30,
    aiCreditsPerMonth: 25,
    reorganizeMaxBins: 10,
  },
  upgradeUrl: 'https://example.com/upgrade',
  upgradePlusUrl: null,
  upgradeProUrl: 'https://example.com/auth/openbin?token=abc&plan=pro',
  portalUrl: 'https://example.com/portal?token=abc',
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: { used: 5, limit: 25, resetsAt: null },
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

const PRO_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: '2027-01-01T00:00:00.000Z',
  previousSubStatus: null,
  selfHosted: false,
  locked: false,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    reorganize: true,
    binSharing: true,
    attachments: true,
    maxBins: 1000,
    maxLocations: 10,
    maxPhotoStorageMb: 1024,
    maxMembersPerLocation: 10,
    activityRetentionDays: 90,
    aiCreditsPerMonth: 250,
    reorganizeMaxBins: 40,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: 'https://example.com/portal?token=abc',
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

function makeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(PlanProvider, null, children);
  };
}

function mockPlanFetch(plan: PlanInfo) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/api/plan/usage') return Promise.resolve(MOCK_USAGE);
    return Promise.resolve(plan);
  });
}

describe('usePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSelfHosted.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ token: 'cookie' } as ReturnType<typeof useAuth>);
  });

  it('throws when used outside PlanProvider', () => {
    expect(() => renderHook(() => usePlan())).toThrow('usePlan must be used within PlanProvider');
  });

  it('provides self-hosted plan when API returns selfHosted: true', async () => {
    mockPlanFetch(SELF_HOSTED_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.selfHosted).toBe(true);
    expect(result.current.planInfo.plan).toBe('pro');
    expect(result.current.isSelfHosted).toBe(true);
    expect(result.current.isPro).toBe(true);
    expect(result.current.isPlus).toBe(false);
    expect(result.current.isFree).toBe(false);
  });

  it('does not fetch /api/plan or /api/plan/usage on self-hosted builds', async () => {
    mockIsSelfHosted.mockReturnValue(true);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.planInfo.selfHosted).toBe(true);
    expect(result.current.planInfo.plan).toBe('pro');
    expect(result.current.isSelfHosted).toBe(true);
    expect(result.current.usage).toBeNull();
    expect(result.current.overLimits).toBeNull();
    expect(result.current.isOverAnyLimit).toBe(false);
  });

  it('provides free plan info for free users', async () => {
    mockPlanFetch(FREE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.plan).toBe('free');
    expect(result.current.isFree).toBe(true);
    expect(result.current.isPlus).toBe(false);
    expect(result.current.isPro).toBe(false);
    expect(result.current.isSelfHosted).toBe(false);
  });

  it('provides plus plan info for plus users', async () => {
    mockPlanFetch(PLUS_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.plan).toBe('plus');
    expect(result.current.isPlus).toBe(true);
    expect(result.current.isFree).toBe(false);
    expect(result.current.isPro).toBe(false);
    expect(result.current.isSelfHosted).toBe(false);
  });

  it('provides pro plan info for pro users', async () => {
    mockPlanFetch(PRO_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.plan).toBe('pro');
    expect(result.current.isPro).toBe(true);
    expect(result.current.isPlus).toBe(false);
    expect(result.current.isFree).toBe(false);
    expect(result.current.isSelfHosted).toBe(false);
  });

  it('isGated returns true for gated boolean features on free plan', async () => {
    mockPlanFetch(FREE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGated('ai')).toBe(false);
    expect(result.current.isGated('apiKeys')).toBe(true);
    expect(result.current.isGated('customFields')).toBe(true);
    expect(result.current.isGated('fullExport')).toBe(true);
  });

  it('isGated returns false for numeric limit features (not boolean)', async () => {
    mockPlanFetch(FREE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Numeric limits are not boolean-gated via isGated
    expect(result.current.isGated('maxLocations')).toBe(false);
  });

  it('isGated returns false for all features on pro plan', async () => {
    mockPlanFetch(PRO_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGated('ai')).toBe(false);
    expect(result.current.isGated('apiKeys')).toBe(false);
    expect(result.current.isGated('customFields')).toBe(false);
    expect(result.current.isGated('fullExport')).toBe(false);
  });

  it('falls back to locked plan on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.locked).toBe(true);
    expect(result.current.planInfo.plan).toBe('free');
    expect(result.current.isPro).toBe(false);
  });

  it('does not fetch when not authenticated', async () => {
    mockUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).not.toHaveBeenCalled();
    // Falls back to locked plan when no token
    expect(result.current.planInfo.locked).toBe(true);
    expect(result.current.isPro).toBe(false);
  });
});
