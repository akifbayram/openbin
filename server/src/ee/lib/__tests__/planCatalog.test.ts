import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/config.js', () => ({
  config: {
    planLimits: {
      freeMaxBins: 10, freeMaxLocations: 1, freeMaxStorageMb: 0, freeMaxMembers: 1,
      freeAi: true, freeApiKeys: false, freeCustomFields: false, freeFullExport: false,
      freeReorganize: false, freeBinSharing: false, freeAttachments: false,
      freeActivityRetentionDays: 7, freeAiCreditsPerMonth: 10,
      plusMaxBins: 100, plusMaxLocations: 1, plusMaxStorageMb: 100, plusMaxMembers: 1,
      plusAi: true, plusApiKeys: false, plusCustomFields: false, plusFullExport: true,
      plusReorganize: true, plusBinSharing: false, plusAttachments: false,
      plusActivityRetentionDays: 30, plusAiCreditsPerMonth: 25, plusReorganizeMaxBins: 10,
      proMaxBins: 1000, proMaxLocations: 10, proMaxStorageMb: 1024, proMaxMembers: 10,
      proActivityRetentionDays: 90, proAiCreditsPerMonth: 250, proReorganizeMaxBins: 40,
    },
    planPrices: {
      plusQuarterlyCents: 1500, plusAnnualCents: 5000,
      proQuarterlyCents: 3000, proAnnualCents: 10000,
    },
  },
}));

import { getPlanCatalog } from '../planCatalog.js';

describe('getPlanCatalog', () => {
  it('returns free, plus, and pro plans in that order', () => {
    const { plans } = getPlanCatalog();
    expect(plans.map(p => p.id)).toEqual(['free', 'plus', 'pro']);
  });

  it('free plan has zero prices', () => {
    const { plans } = getPlanCatalog();
    const free = plans.find(p => p.id === 'free')!;
    expect(free.prices).toEqual({ quarterly: 0, annual: null });
  });

  it('plus plan has quarterly + annual prices in cents', () => {
    const { plans } = getPlanCatalog();
    const plus = plans.find(p => p.id === 'plus')!;
    expect(plus.prices).toEqual({ quarterly: 1500, annual: 5000 });
  });

  it('pro plan exposes its feature limits', () => {
    const { plans } = getPlanCatalog();
    const pro = plans.find(p => p.id === 'pro')!;
    expect(pro.features.maxBins).toBe(1000);
    expect(pro.features.aiCreditsPerMonth).toBe(250);
  });

  it('omits marketing copy', () => {
    const { plans } = getPlanCatalog();
    for (const plan of plans) {
      expect(plan).not.toHaveProperty('tagline');
      expect(plan).not.toHaveProperty('description');
    }
  });
});
