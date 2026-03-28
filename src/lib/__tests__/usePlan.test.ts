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

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PlanProvider, usePlan } from '@/lib/usePlan';
import type { PlanInfo } from '@/types';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

const SELF_HOSTED_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: null,
  selfHosted: true,
  locked: false,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    reorganize: true,
    binSharing: true,
    webhooks: true,
    maxLocations: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
  },
  upgradeUrl: null,
  upgradeLiteUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
};

const LITE_PLAN: PlanInfo = {
  plan: 'lite',
  status: 'inactive',
  activeUntil: null,
  selfHosted: false,
  locked: true,
  features: {
    ai: false,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    reorganize: false,
    binSharing: false,
    webhooks: false,
    maxLocations: 1,
    maxPhotoStorageMb: 100,
    maxMembersPerLocation: 1,
    activityRetentionDays: 90,
  },
  upgradeUrl: 'https://example.com/upgrade',
  upgradeLiteUrl: 'https://example.com/auth/openbin?token=abc&plan=lite',
  upgradeProUrl: 'https://example.com/auth/openbin?token=abc&plan=pro',
  portalUrl: null,
};

const PRO_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: '2027-01-01T00:00:00.000Z',
  selfHosted: false,
  locked: false,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    reorganize: true,
    binSharing: true,
    webhooks: true,
    maxLocations: null,
    maxPhotoStorageMb: 5000,
    maxMembersPerLocation: null,
    activityRetentionDays: 90,
  },
  upgradeUrl: null,
  upgradeLiteUrl: null,
  upgradeProUrl: null,
  portalUrl: 'https://example.com/portal?token=abc',
};

function makeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(PlanProvider, null, children);
  };
}

describe('usePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ token: 'cookie' } as ReturnType<typeof useAuth>);
  });

  it('throws when used outside PlanProvider', () => {
    expect(() => renderHook(() => usePlan())).toThrow('usePlan must be used within PlanProvider');
  });

  it('provides self-hosted plan when API returns selfHosted: true', async () => {
    mockApiFetch.mockResolvedValue(SELF_HOSTED_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.selfHosted).toBe(true);
    expect(result.current.planInfo.plan).toBe('pro');
    expect(result.current.isSelfHosted).toBe(true);
    expect(result.current.isPro).toBe(true);
    expect(result.current.isLite).toBe(false);
  });

  it('provides lite plan info for lite users', async () => {
    mockApiFetch.mockResolvedValue(LITE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.plan).toBe('lite');
    expect(result.current.isLite).toBe(true);
    expect(result.current.isPro).toBe(false);
    expect(result.current.isSelfHosted).toBe(false);
  });

  it('provides pro plan info for pro users', async () => {
    mockApiFetch.mockResolvedValue(PRO_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.plan).toBe('pro');
    expect(result.current.isPro).toBe(true);
    expect(result.current.isLite).toBe(false);
    expect(result.current.isSelfHosted).toBe(false);
  });

  it('isGated returns true for gated boolean features on lite plan', async () => {
    mockApiFetch.mockResolvedValue(LITE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGated('ai')).toBe(true);
    expect(result.current.isGated('apiKeys')).toBe(true);
    expect(result.current.isGated('customFields')).toBe(true);
    expect(result.current.isGated('fullExport')).toBe(true);
  });

  it('isGated returns false for numeric limit features (not boolean)', async () => {
    mockApiFetch.mockResolvedValue(LITE_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Numeric limits are not boolean-gated via isGated
    expect(result.current.isGated('maxLocations')).toBe(false);
  });

  it('isGated returns false for all features on pro plan', async () => {
    mockApiFetch.mockResolvedValue(PRO_PLAN);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGated('ai')).toBe(false);
    expect(result.current.isGated('apiKeys')).toBe(false);
    expect(result.current.isGated('customFields')).toBe(false);
    expect(result.current.isGated('fullExport')).toBe(false);
  });

  it('falls back to self-hosted plan on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.planInfo.selfHosted).toBe(true);
    expect(result.current.isPro).toBe(true);
  });

  it('does not fetch when not authenticated', async () => {
    mockUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => usePlan(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).not.toHaveBeenCalled();
    // Falls back to self-hosted plan as default
    expect(result.current.isPro).toBe(true);
  });
});
