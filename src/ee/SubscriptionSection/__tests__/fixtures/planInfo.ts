import type { PlanInfo, PlanUsage } from '@/types';

const BASE_FEATURES = {
  ai: true, apiKeys: false, customFields: false, fullExport: false,
  reorganize: false, binSharing: false, attachments: false,
  maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0,
  maxMembersPerLocation: 1, activityRetentionDays: 7,
  aiCreditsPerMonth: 10, reorganizeMaxBins: 10,
};

export function makePlanInfo(overrides: Partial<PlanInfo> = {}): PlanInfo {
  return {
    plan: 'free',
    status: 'active',
    activeUntil: null,
    previousSubStatus: null,
    selfHosted: false,
    locked: false,
    cancelAtPeriodEnd: null,
    billingPeriod: null,
    features: BASE_FEATURES,
    upgradeUrl: null, upgradePlusUrl: null, upgradeProUrl: null,
    portalUrl: null, subscribePlanUrl: null,
    upgradeAction: null, upgradePlusAction: null, upgradeProAction: null,
    subscribePlanAction: null, portalAction: null,
    canDowngradeToFree: false,
    aiCredits: null,
    ...overrides,
  };
}

export const EMPTY_USAGE: PlanUsage = {
  binCount: 0, locationCount: 1, photoStorageMb: 0,
  memberCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};
