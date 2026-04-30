import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanFeatures, PlanUsage } from '@/types';
import { UsageRow } from '../UsageRow';

const PRO_FEATURES: PlanFeatures = {
  ai: true, apiKeys: true, customFields: true, fullExport: true,
  reorganize: true, binSharing: true, attachments: true,
  maxBins: 1000, maxLocations: 10, maxPhotoStorageMb: 1024,
  maxMembersPerLocation: 10, activityRetentionDays: 90,
  aiCreditsPerMonth: 250, reorganizeMaxBins: 40,
};

const PRO_USAGE: PlanUsage = {
  binCount: 1, locationCount: 1, photoStorageMb: 0,
  memberCounts: { 'loc-1': 1 },
  viewerCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};

describe('UsageRow', () => {
  it('renders bins, locations, members, photos, AI for Pro user', () => {
    render(
      <UsageRow
        usage={PRO_USAGE}
        features={PRO_FEATURES}
        aiCredits={{ used: 4, limit: 250, resetsAt: null }}
      />,
    );
    expect(screen.getByText(/bins/)).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getByText(/locations/)).toBeInTheDocument();
    expect(screen.getByText(/members/)).toBeInTheDocument();
    expect(screen.getByText(/MB/)).toBeInTheDocument();
    expect(screen.getByText(/AI/)).toBeInTheDocument();
  });

  it('hides metrics with limit 1 (single-slot)', () => {
    const FREE_FEATURES: PlanFeatures = {
      ...PRO_FEATURES,
      maxLocations: 1,
      maxMembersPerLocation: 1,
    };
    render(<UsageRow usage={PRO_USAGE} features={FREE_FEATURES} aiCredits={null} />);
    expect(screen.queryByText(/locations/)).toBeNull();
    expect(screen.queryByText(/members/)).toBeNull();
  });

  it('renders nothing when no metric passes the hide rule', () => {
    const NO_LIMITS: PlanFeatures = {
      ...PRO_FEATURES,
      maxBins: null, maxLocations: null,
      maxPhotoStorageMb: null, maxMembersPerLocation: null,
    };
    const { container } = render(
      <UsageRow usage={PRO_USAGE} features={NO_LIMITS} aiCredits={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not render any progressbar role', () => {
    render(
      <UsageRow
        usage={PRO_USAGE}
        features={PRO_FEATURES}
        aiCredits={{ used: 4, limit: 250, resetsAt: null }}
      />,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
