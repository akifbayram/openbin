import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanFeatures, PlanUsage } from '@/types';
import { CurrentPlanCard } from '../CurrentPlanCard';

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

describe('CurrentPlanCard', () => {
  it('Pro active quarterly: shows PRO eyebrow, Active title, Renews + quarterly price', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod="quarterly" trialPeriodDays={7}
        priceCents={1000} annualSavingsCents={2000}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/Renews May 27, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/\$10 \/ quarter/)).toBeInTheDocument();
    expect(screen.queryByText(/Saving/)).toBeNull();
  });

  it('Pro active annual: shows /year price + Saving recognition line', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod="annual" trialPeriodDays={7}
        priceCents={10000} annualSavingsCents={2000}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText(/\$100 \/ year/)).toBeInTheDocument();
    expect(screen.getByText(/Saving \$20\/yr on annual billing/)).toBeInTheDocument();
  });

  it('Pro active annual with no savings: hides bonus line', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod="annual" trialPeriodDays={7}
        priceCents={10000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.queryByText(/Saving/)).toBeNull();
  });

  it('Cancel pending: shows "Cancels [date]" + access copy, no Renews', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd="2026-05-27T00:00:00Z" billingPeriod="quarterly"
        trialPeriodDays={7} priceCents={1000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText(/Cancels May 27, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/You'll keep Pro access until then/)).toBeInTheDocument();
    expect(screen.queryByText(/Renews/)).toBeNull();
  });

  it('Trial: shows TRIAL eyebrow, days remaining, "Then $X / quarter", trial bar', () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    render(
      <CurrentPlanCard
        plan="pro" status="trial" activeUntil={future}
        cancelAtPeriodEnd={null} billingPeriod={null} trialPeriodDays={7}
        priceCents={1000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText('PRO TRIAL')).toBeInTheDocument();
    expect(screen.getByText(/5 days remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Then \$10 \/ quarter/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /trial progress/i })).toBeInTheDocument();
  });

  it('Active without activeUntil: hides the meta line entirely', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil={null}
        cancelAtPeriodEnd={null} billingPeriod="quarterly" trialPeriodDays={7}
        priceCents={1000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.queryByText(/Renews/)).toBeNull();
    expect(screen.queryByText(/\/ quarter/)).toBeNull();
  });

  it('Active without priceCents: shows Renews date but no price suffix', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod="quarterly" trialPeriodDays={7}
        priceCents={null} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText(/Renews May 27, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/\/ quarter/)).toBeNull();
  });

  it('Trial with trialDaysLeft===0: shows "Trial ended" copy', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="trial" activeUntil="2020-01-01T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod={null} trialPeriodDays={7}
        priceCents={1000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
    expect(screen.queryByText(/days remaining/)).toBeNull();
  });

  it('Trial with null activeUntil: shows "Trial ended", never "null days remaining"', () => {
    render(
      <CurrentPlanCard
        plan="pro" status="trial" activeUntil={null}
        cancelAtPeriodEnd={null} billingPeriod={null} trialPeriodDays={7}
        priceCents={1000} annualSavingsCents={0}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('Plus active quarterly: eyebrow shows PLUS (not PRO)', () => {
    render(
      <CurrentPlanCard
        plan="plus" status="active" activeUntil="2026-05-27T00:00:00Z"
        cancelAtPeriodEnd={null} billingPeriod="quarterly" trialPeriodDays={7}
        priceCents={500} annualSavingsCents={1000}
        usage={PRO_USAGE} features={PRO_FEATURES} aiCredits={null}
      />,
    );
    expect(screen.getByText('PLUS')).toBeInTheDocument();
    expect(screen.queryByText('PRO')).toBeNull();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
