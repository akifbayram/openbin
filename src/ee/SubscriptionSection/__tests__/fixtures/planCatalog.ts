import type { PlanCatalog } from '@/types';

export const FIXTURE_CATALOG: PlanCatalog = {
  plans: [
    {
      id: 'free', name: 'Free',
      prices: { monthly: 0, annual: null },
      features: {
        ai: true, apiKeys: false, customFields: false, fullExport: false,
        reorganize: false, binSharing: false, attachments: false,
        maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0,
        maxMembersPerLocation: 1, activityRetentionDays: 7,
        aiCreditsPerMonth: 10, reorganizeMaxBins: 10,
      },
    },
    {
      id: 'plus', name: 'Plus',
      prices: { monthly: 500, annual: 5000 },
      features: {
        ai: true, apiKeys: false, customFields: false, fullExport: true,
        reorganize: true, binSharing: false, attachments: false,
        maxBins: 100, maxLocations: 1, maxPhotoStorageMb: 100,
        maxMembersPerLocation: 1, activityRetentionDays: 30,
        aiCreditsPerMonth: 25, reorganizeMaxBins: 10,
      },
    },
    {
      id: 'pro', name: 'Pro',
      prices: { monthly: 1000, annual: 10000 },
      features: {
        ai: true, apiKeys: true, customFields: true, fullExport: true,
        reorganize: true, binSharing: true, attachments: true,
        maxBins: 1000, maxLocations: 10, maxPhotoStorageMb: 1024,
        maxMembersPerLocation: 10, activityRetentionDays: 90,
        aiCreditsPerMonth: 250, reorganizeMaxBins: 40,
      },
    },
  ],
};
