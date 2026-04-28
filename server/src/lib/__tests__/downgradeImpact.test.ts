import { describe, expect, it } from 'vitest';
import { computeDowngradeImpact } from '../downgradeImpact.js';
import type { PlanFeatures } from '../planGate.js';

const PRO_FEATURES: PlanFeatures = {
  ai: true, apiKeys: true, customFields: true, fullExport: true,
  reorganize: true, binSharing: true, attachments: true,
  maxBins: 1000, maxLocations: 10, maxPhotoStorageMb: 1024,
  maxMembersPerLocation: 10, activityRetentionDays: 90,
  aiCreditsPerMonth: 250, reorganizeMaxBins: 40,
};

const FREE_FEATURES: PlanFeatures = {
  ai: true, apiKeys: false, customFields: false, fullExport: false,
  reorganize: false, binSharing: false, attachments: false,
  maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0,
  maxMembersPerLocation: 1, activityRetentionDays: 7,
  aiCreditsPerMonth: 10, reorganizeMaxBins: 10,
};

describe('computeDowngradeImpact', () => {
  it('reports bin overage with read-only count', () => {
    const usage = { binCount: 47, locationCount: 1, photoStorageMb: 0, memberCounts: {}, photoCount: 0 };
    const impact = computeDowngradeImpact({ currentFeatures: PRO_FEATURES, targetFeatures: FREE_FEATURES, targetPlan: 'free', usage });
    const bins = impact.warnings.find(w => w.title.startsWith('47 bins'));
    expect(bins).toBeDefined();
    expect(bins!.kind).toBe('usage-exceeded');
    expect(bins!.description).toContain('37');
  });

  it('reports location overage', () => {
    const usage = { binCount: 5, locationCount: 3, photoStorageMb: 0, memberCounts: {}, photoCount: 0 };
    const impact = computeDowngradeImpact({ currentFeatures: PRO_FEATURES, targetFeatures: FREE_FEATURES, targetPlan: 'free', usage });
    expect(impact.warnings.some(w => w.title.includes('3 locations'))).toBe(true);
  });

  it('reports feature loss for ai/customFields/etc', () => {
    const impact = computeDowngradeImpact({
      currentFeatures: PRO_FEATURES, targetFeatures: FREE_FEATURES, targetPlan: 'free',
      usage: { binCount: 0, locationCount: 1, photoStorageMb: 0, memberCounts: {}, photoCount: 0 },
    });
    const featureWarnings = impact.warnings.filter(w => w.kind === 'feature-loss');
    expect(featureWarnings.map(w => w.title)).toContain('Custom fields');
    expect(featureWarnings.map(w => w.title)).toContain('Reorganize');
  });

  it('does NOT warn when usage is exactly at target limit', () => {
    const usage = { binCount: 10, locationCount: 1, photoStorageMb: 0, memberCounts: {}, photoCount: 0 };
    const impact = computeDowngradeImpact({ currentFeatures: PRO_FEATURES, targetFeatures: FREE_FEATURES, targetPlan: 'free', usage });
    expect(impact.warnings.some(w => w.title.startsWith('10 bins'))).toBe(false);
  });

  it('handles unlimited target (no usage warnings, just feature deltas)', () => {
    const PLUS_LIKE = {
      ...PRO_FEATURES,
      customFields: false,
      apiKeys: false,
      maxBins: null,
      maxLocations: null,
      maxPhotoStorageMb: null,
    };
    const impact = computeDowngradeImpact({
      currentFeatures: PRO_FEATURES, targetFeatures: PLUS_LIKE, targetPlan: 'plus',
      usage: { binCount: 5000, locationCount: 50, photoStorageMb: 9999, memberCounts: {}, photoCount: 0 },
    });
    expect(impact.warnings.every(w => w.kind === 'feature-loss')).toBe(true);
  });
});
