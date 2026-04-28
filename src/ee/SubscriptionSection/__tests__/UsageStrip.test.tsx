import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanFeatures, PlanUsage } from '@/types';
import { UsageStrip } from '../UsageStrip';

const FREE_FEATURES: PlanFeatures = {
  ai: true, apiKeys: false, customFields: false, fullExport: false,
  reorganize: false, binSharing: false, attachments: false,
  maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0,
  maxMembersPerLocation: 1, activityRetentionDays: 7,
  aiCreditsPerMonth: 10, reorganizeMaxBins: 10,
};

const USAGE: PlanUsage = {
  binCount: 8, locationCount: 1, photoStorageMb: 0,
  memberCounts: { 'loc-1': 1 },
  overLimits: { locations: false, photos: false, members: [] },
};

describe('UsageStrip', () => {
  it('renders bins and AI metrics for Free user', () => {
    render(<UsageStrip usage={USAGE} features={FREE_FEATURES} aiCredits={{ used: 5, limit: 10, resetsAt: null }} />);
    expect(screen.getByText(/8\s*\/\s*10/)).toBeInTheDocument();
    expect(screen.getByText(/5\s*\/\s*10/)).toBeInTheDocument();
  });

  it('hides locations + members on Free (1/1 single-slot)', () => {
    render(<UsageStrip usage={USAGE} features={FREE_FEATURES} aiCredits={{ used: 5, limit: 10, resetsAt: null }} />);
    expect(screen.queryByText(/locations/i)).toBeNull();
    expect(screen.queryByText(/members/i)).toBeNull();
  });

  it('hides photos when limit is 0', () => {
    render(<UsageStrip usage={USAGE} features={FREE_FEATURES} aiCredits={{ used: 5, limit: 10, resetsAt: null }} />);
    expect(screen.queryByText(/photos/i)).toBeNull();
  });

  it('renders red tone when at 100% usage', () => {
    render(<UsageStrip usage={{ ...USAGE, binCount: 10 }} features={FREE_FEATURES} aiCredits={null} />);
    const bar = screen.getByRole('progressbar', { name: /bins/i });
    const innerFill = bar.firstChild as HTMLElement;
    expect(innerFill.className).toMatch(/red/);
  });

  it('returns null when no metrics pass hide rule', () => {
    const NULL_FEATURES: PlanFeatures = { ...FREE_FEATURES, maxBins: null };
    const { container } = render(<UsageStrip usage={{ ...USAGE, binCount: 5 }} features={NULL_FEATURES} aiCredits={null} />);
    expect(container.firstChild).toBeNull();
  });
});
