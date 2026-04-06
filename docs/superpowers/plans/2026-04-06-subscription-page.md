# Subscription Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the EE subscription section from a collapsible card into a proper settings page with a prominent plan header, contextual usage warnings, next-tier unlock pitch, and billing management links.

**Architecture:** Single file refactor of `src/ee/SubscriptionSection.tsx`. Reuses existing `SettingsSection` and `SettingsRow` patterns from the settings feature. All existing payment-return polling, visibility-refresh, and downgrade logic is preserved. New pure functions `getNextTierFeatures` and `isNearLimit` added. Tests updated in place.

**Tech Stack:** React 18, TypeScript, Vitest (happy-dom), Tailwind CSS 4 with CSS custom property design tokens.

**Spec:** `docs/superpowers/specs/2026-04-06-subscription-page-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/ee/SubscriptionSection.tsx` | Full rewrite — plan header, usage warnings, unlock section, billing section |
| Modify | `src/ee/__tests__/SubscriptionSection.test.tsx` | Update existing tests for new markup, add 9 new tests |

---

## Task 1: Update test infrastructure and existing tests

The component markup is changing significantly (removing `Card`, `Disclosure`, changing layout), so existing tests need updated selectors while preserving the same behavioral assertions.

**Files:**
- Modify: `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Add `setupMockWithUsage` helper and update `setupMock` to supply usage data**

The current `setupMock` always passes `usage: null`. Several new tests need usage data, and some existing tests need it too since the component will now conditionally render usage warnings. Add a helper that provides usage data.

Open `src/ee/__tests__/SubscriptionSection.test.tsx` and add a `BASE_USAGE` constant and update `setupMock` to accept optional usage:

```ts
const BASE_USAGE: PlanUsage = {
  binCount: 10,
  locationCount: 1,
  photoStorageMb: 5,
  memberCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};

function setupMock(planInfo: PlanInfo, opts?: { isLocked?: boolean; usage?: PlanUsage | null }) {
  mockUsePlan.mockReturnValue({
    planInfo,
    isPro: planInfo.plan === 'pro',
    isPlus: planInfo.plan === 'plus',
    isFree: planInfo.plan === 'free',
    isSelfHosted: planInfo.selfHosted,
    isLocked: opts?.isLocked ?? planInfo.locked,
    isLoading: false,
    isGated: () => false,
    refresh: mockRefresh,
    usage: opts?.usage !== undefined ? opts.usage : null,
    overLimits: null,
    isOverAnyLimit: false,
    isLocationOverLimit: () => false,
    refreshUsage: mockRefreshUsage,
  });
}
```

- [ ] **Step 2: Update existing test 1 — "Switch to Free Plan" for trial user**

The assertion stays the same. The test just needs to confirm text is still findable:

```ts
it('shows "Switch to Free Plan" button for trial user with canDowngradeToFree=true', () => {
  setupMock(makePlanInfo({
    status: 'trial',
    activeUntil: '2027-01-01T00:00:00.000Z',
    subscribePlanUrl: 'https://billing.example.com/checkout',
    upgradeProUrl: 'https://billing.example.com/pro',
    canDowngradeToFree: true,
  }));

  renderSection();

  expect(screen.getByText('Switch to Free Plan')).toBeDefined();
});
```

No change needed — the new component still renders "Switch to Free Plan" text.

- [ ] **Step 3: Update existing test 4 — free plan "Upgrade" button**

The old test checked for an `<a>` element with text "Upgrade". The new component renders the CTA inside the plan header as an `<a>` link. Update to match new structure:

```ts
it('shows single "Upgrade" button for free plan users instead of "Manage Subscription"', () => {
  setupMock(makePlanInfo({
    plan: 'free',
    status: 'inactive',
    portalUrl: 'https://billing.example.com/portal',
    upgradeUrl: 'https://billing.example.com/upgrade',
    upgradePlusUrl: 'https://billing.example.com/plus',
    upgradeProUrl: 'https://billing.example.com/pro',
  }));

  renderSection();

  expect(screen.queryByText('Manage Subscription')).toBeNull();
  const upgradeLink = screen.getByText('Upgrade');
  expect(upgradeLink).toBeDefined();
  expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('https://billing.example.com/upgrade');
});
```

No change needed — same assertion, component still renders "Upgrade" link to `upgradeUrl`.

- [ ] **Step 4: Run existing tests to verify they still pass with current component**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: All 4 tests PASS (the helper changes are additive and don't affect existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/ee/__tests__/SubscriptionSection.test.tsx
git commit -m "test: add usage helper to subscription section tests"
```

---

## Task 2: Write new failing tests for plan header badges

**Files:**
- Modify: `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Write test — plan header shows "Trial" badge**

```ts
it('shows Trial badge for trial users', () => {
  setupMock(makePlanInfo({
    status: 'trial',
    activeUntil: '2027-01-01T00:00:00.000Z',
    subscribePlanUrl: 'https://billing.example.com/checkout',
  }));

  renderSection();

  expect(screen.getByText('Trial')).toBeDefined();
  expect(screen.getByText(/Plus Plan/)).toBeDefined();
});
```

- [ ] **Step 2: Write test — plan header shows "Active" badge**

```ts
it('shows Active badge for active subscribers', () => {
  setupMock(makePlanInfo({
    status: 'active',
    portalUrl: 'https://billing.example.com/portal',
  }));

  renderSection();

  expect(screen.getByText('Active')).toBeDefined();
  expect(screen.getByText(/Plus Plan/)).toBeDefined();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: 2 new tests FAIL (old component uses "Plus Plan" in different context and doesn't render "Active" badge).

- [ ] **Step 4: Commit failing tests**

```bash
git add src/ee/__tests__/SubscriptionSection.test.tsx
git commit -m "test: add failing tests for plan header badges"
```

---

## Task 3: Write new failing tests for locked banner

**Files:**
- Modify: `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Write test — locked banner shown when locked**

```ts
it('shows locked warning banner when subscription is locked', () => {
  setupMock(makePlanInfo({
    status: 'inactive',
    locked: true,
    previousSubStatus: 'active',
    upgradeUrl: 'https://billing.example.com/upgrade',
    canDowngradeToFree: true,
  }), { isLocked: true });

  renderSection();

  expect(screen.getByText('Your subscription has expired. Resubscribe to continue using OpenBin.')).toBeDefined();
});
```

- [ ] **Step 2: Write test — locked banner hidden when not locked**

```ts
it('does not show locked warning banner for active subscribers', () => {
  setupMock(makePlanInfo({
    status: 'active',
    portalUrl: 'https://billing.example.com/portal',
  }));

  renderSection();

  expect(screen.queryByText(/expired|ended|inactive/i)).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: At least 1 new test FAILs (old component renders locked message inside a Disclosure, the "hidden when not locked" test may already pass).

- [ ] **Step 4: Commit**

```bash
git add src/ee/__tests__/SubscriptionSection.test.tsx
git commit -m "test: add failing tests for locked warning banner"
```

---

## Task 4: Write new failing tests for usage warnings

**Files:**
- Modify: `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Write test — usage warnings hidden when under limits**

```ts
it('hides usage warnings when all metrics are under limits', () => {
  setupMock(
    makePlanInfo({ status: 'active', portalUrl: 'https://billing.example.com/portal' }),
    { usage: { ...BASE_USAGE, binCount: 10 } },
  );

  renderSection();

  expect(screen.queryByText('Usage')).toBeNull();
  expect(screen.queryByText(/Over limit/)).toBeNull();
});
```

- [ ] **Step 2: Write test — usage warnings shown when over limit**

```ts
it('shows usage warning when bins exceed limit', () => {
  setupMock(
    makePlanInfo({
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
      features: { ...BASE_FEATURES, maxBins: 500 },
    }),
    { usage: { ...BASE_USAGE, binCount: 520 } },
  );

  renderSection();

  expect(screen.getByText('Usage')).toBeDefined();
  expect(screen.getByText(/Over limit/)).toBeDefined();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: At least the "over limit" test FAILs (old component shows usage tiles always, not conditionally, and uses different "Over limit" rendering).

- [ ] **Step 4: Commit**

```bash
git add src/ee/__tests__/SubscriptionSection.test.tsx
git commit -m "test: add failing tests for contextual usage warnings"
```

---

## Task 5: Write new failing tests for unlock section

**Files:**
- Modify: `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Write test — unlock section shown for free users**

```ts
it('shows "Unlock with Plus" section for free users', () => {
  setupMock(makePlanInfo({
    plan: 'free',
    status: 'inactive',
    upgradeUrl: 'https://billing.example.com/upgrade',
    upgradePlusUrl: 'https://billing.example.com/plus',
    features: {
      ...BASE_FEATURES,
      ai: false,
      customFields: false,
      fullExport: false,
      maxBins: 50,
      maxLocations: 1,
      maxPhotoStorageMb: 0,
      maxMembersPerLocation: 1,
      aiCreditsPerMonth: 0,
    },
  }));

  renderSection();

  expect(screen.getByText('Unlock with Plus')).toBeDefined();
  expect(screen.getByText('AI-powered features')).toBeDefined();
});
```

- [ ] **Step 2: Write test — unlock section shown for active Plus**

```ts
it('shows "Unlock with Pro" section for active Plus users', () => {
  setupMock(makePlanInfo({
    status: 'active',
    portalUrl: 'https://billing.example.com/portal',
    upgradeProUrl: 'https://billing.example.com/pro',
    features: {
      ...BASE_FEATURES,
      apiKeys: false,
      reorganize: false,
      binSharing: false,
    },
  }));

  renderSection();

  expect(screen.getByText('Unlock with Pro')).toBeDefined();
  expect(screen.getByText('API keys')).toBeDefined();
});
```

- [ ] **Step 3: Write test — unlock section hidden for Pro users**

```ts
it('does not show unlock section for active Pro users', () => {
  setupMock(makePlanInfo({
    plan: 'pro',
    status: 'active',
    portalUrl: 'https://billing.example.com/portal',
    features: {
      ...BASE_FEATURES,
      apiKeys: true,
      reorganize: true,
      binSharing: true,
      maxBins: null,
      maxLocations: null,
      maxPhotoStorageMb: null,
      maxMembersPerLocation: null,
    },
  }));

  renderSection();

  expect(screen.queryByText(/Unlock with/)).toBeNull();
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: All 3 new tests FAIL (old component has no unlock section at all).

- [ ] **Step 5: Commit**

```bash
git add src/ee/__tests__/SubscriptionSection.test.tsx
git commit -m "test: add failing tests for unlock next tier section"
```

---

## Task 6: Implement the refactored SubscriptionSection

This is the main implementation task. Replace the entire component with the new structure while preserving all existing side-effect logic (polling, visibility, downgrade).

**Files:**
- Modify: `src/ee/SubscriptionSection.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

Replace the contents of `src/ee/SubscriptionSection.tsx` with:

```tsx
import { ArrowUpRight, Clock, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { SettingsRow } from '@/features/settings/SettingsRow';
import { apiFetch } from '@/lib/api';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing, isSafeExternalUrl } from '@/lib/utils';
import type { PlanFeatures, PlanTier } from '@/types';

// ── Constants ────────────────────────────────────────────────────────

const NEAR_LIMIT_THRESHOLD = 0.8;

const actionBase = cn(
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] h-10 px-5 text-[14px] font-semibold transition-colors',
  focusRing,
);
const actionPrimary = cn(actionBase, 'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]');
const actionSecondary = cn(actionBase, 'border border-[var(--border-flat)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]');

// ── Pure helpers ─────────────────────────────────────────────────────

interface UsageTile {
  label: string;
  sublabel?: string;
  used: number | string;
  limit: number | string;
  isOver?: boolean;
  isExhausted?: boolean;
}

function buildUsageTiles(
  planInfo: ReturnType<typeof usePlan>['planInfo'],
  usage: ReturnType<typeof usePlan>['usage'],
): UsageTile[] {
  const { features, aiCredits } = planInfo;
  const tiles: UsageTile[] = [];

  if (features.maxBins !== null && usage) {
    tiles.push({
      label: 'Bins',
      used: usage.binCount,
      limit: features.maxBins,
      isOver: usage.binCount > features.maxBins,
    });
  }

  if (aiCredits && aiCredits.limit > 0) {
    const resetsLabel = aiCredits.resetsAt
      ? new Date(aiCredits.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;
    tiles.push({
      label: 'AI Credits',
      sublabel: resetsLabel ? `Resets ${resetsLabel}` : undefined,
      used: aiCredits.used,
      limit: aiCredits.limit,
      isExhausted: aiCredits.used >= aiCredits.limit,
    });
  }

  if (features.maxPhotoStorageMb !== null && usage) {
    tiles.push({
      label: 'Photos',
      used: `${usage.photoStorageMb.toFixed(1)}`,
      limit: features.maxPhotoStorageMb >= 1024
        ? `${(features.maxPhotoStorageMb / 1024).toFixed(0)} GB`
        : `${features.maxPhotoStorageMb} MB`,
      isOver: usage.photoStorageMb > features.maxPhotoStorageMb,
    });
  }

  if (features.maxLocations !== null && usage) {
    tiles.push({
      label: 'Locations',
      used: usage.locationCount,
      limit: features.maxLocations,
      isOver: usage.locationCount > features.maxLocations,
    });
  }

  if (features.maxMembersPerLocation !== null && usage) {
    const maxMembers = Math.max(0, ...Object.values(usage.memberCounts));
    tiles.push({
      label: 'Members',
      used: maxMembers,
      limit: features.maxMembersPerLocation,
      isOver: maxMembers > features.maxMembersPerLocation,
    });
  }

  return tiles;
}

function isNearLimit(tile: UsageTile): boolean {
  if (tile.isOver || tile.isExhausted) return true;
  const used = typeof tile.used === 'number' ? tile.used : parseFloat(tile.used);
  const limit = typeof tile.limit === 'number' ? tile.limit : parseFloat(tile.limit);
  if (isNaN(used) || isNaN(limit) || limit <= 0) return false;
  return used / limit >= NEAR_LIMIT_THRESHOLD;
}

const PLUS_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Up to 500 bins' },
  { key: 'ai', label: 'AI-powered features' },
  { key: 'customFields', label: 'Custom fields' },
  { key: 'fullExport', label: 'Full data export' },
];

const PRO_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Unlimited bins' },
  { key: 'apiKeys', label: 'API keys' },
  { key: 'reorganize', label: 'AI reorganization' },
  { key: 'binSharing', label: 'Bin sharing links' },
  { key: 'maxLocations', label: 'Unlimited locations' },
  { key: 'maxPhotoStorageMb', label: 'Expanded photo storage' },
];

function getNextTierFeatures(plan: PlanTier, features: PlanFeatures): string[] {
  const list = plan === 'free' ? PLUS_FEATURES : PRO_FEATURES;
  return list
    .filter(({ key }) => {
      const val = features[key];
      if (typeof val === 'boolean') return !val;
      if (typeof val === 'number') return true; // numeric limits are upgradeable
      return false;
    })
    .map(({ label }) => label);
}

function getPlanSubtitle(plan: PlanTier, features: PlanFeatures): string {
  if (plan === 'pro') return 'Unlimited · All features';
  if (plan === 'plus') {
    const parts: string[] = [];
    if (features.maxBins !== null) parts.push(`${features.maxBins} bins`);
    if (features.ai) parts.push('AI credits');
    if (features.customFields) parts.push('Custom fields');
    return parts.join(' · ') || 'Plus features';
  }
  // free
  const parts: string[] = [];
  if (features.maxBins !== null) parts.push(`${features.maxBins} bins`);
  if (features.maxLocations !== null) parts.push(`${features.maxLocations} location${features.maxLocations !== 1 ? 's' : ''}`);
  return parts.join(' · ') || 'Basic features';
}

function getPrimaryCta(
  planInfo: ReturnType<typeof usePlan>['planInfo'],
  isLocked: boolean,
): { label: string; href: string } | null {
  if (isLocked) {
    const label = getLockedCta(planInfo.previousSubStatus);
    const href = planInfo.subscribePlanUrl ?? planInfo.upgradeUrl;
    if (href) return { label, href };
    return null;
  }

  const isTrialing = planInfo.status === 'trial';

  if (planInfo.plan === 'free' && planInfo.upgradeUrl) {
    return { label: 'Upgrade', href: planInfo.upgradeUrl };
  }

  if (isTrialing && planInfo.subscribePlanUrl) {
    const planName = planInfo.plan === 'plus' ? 'Plus' : 'Pro';
    return { label: `Subscribe to ${planName}`, href: planInfo.subscribePlanUrl };
  }

  return null;
}

// ── Sub-components ───────────────────────────────────────────────────

function PlanHeader({
  planInfo,
  isLocked,
}: {
  planInfo: ReturnType<typeof usePlan>['planInfo'];
  isLocked: boolean;
}) {
  const isPro = planInfo.plan === 'pro';
  const isPlus = planInfo.plan === 'plus';
  const isTrialing = planInfo.status === 'trial';
  const isActive = planInfo.status === 'active';

  const daysRemaining = planInfo.activeUntil
    ? Math.max(0, Math.ceil((new Date(planInfo.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const cta = getPrimaryCta(planInfo, isLocked);
  const planLabel = isPro ? 'Pro' : isPlus ? 'Plus' : 'Free';

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-4 py-4 mb-7">
      <div className="flex items-center gap-2">
        <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
          {planLabel} Plan
        </h3>
        {isTrialing && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning)]">
            Trial
          </span>
        )}
        {isActive && !isTrialing && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
            Active
          </span>
        )}
        {isLocked && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--destructive-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--destructive)]">
            Expired
          </span>
        )}
      </div>

      <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
        {getPlanSubtitle(planInfo.plan, planInfo.features)}
      </p>

      {isTrialing && daysRemaining !== null && (
        <p className="text-[12px] text-[var(--color-warning)] mt-2">
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
        </p>
      )}

      {cta && isSafeExternalUrl(cta.href) && (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(actionPrimary, 'mt-3 w-full sm:w-auto')}
        >
          {cta.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function UsageWarnings({ tiles }: { tiles: UsageTile[] }) {
  const warningTiles = tiles.filter(isNearLimit);
  if (warningTiles.length === 0) return null;

  return (
    <SettingsSection label="Usage">
      {warningTiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            'flex items-center gap-2 py-2.5 text-[13px]',
            tile.isOver ? 'text-[var(--destructive)]' : 'text-[var(--color-warning)]',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {tile.label}: {tile.used} / {tile.limit}
            {tile.isOver && <span className="font-medium"> — Over limit</span>}
          </span>
        </div>
      ))}
    </SettingsSection>
  );
}

function UnlockSection({
  planInfo,
}: {
  planInfo: ReturnType<typeof usePlan>['planInfo'];
}) {
  const { plan, features } = planInfo;
  const isTrialing = planInfo.status === 'trial';

  // Pro users and locked users don't see unlock section
  if (plan === 'pro') return null;
  if (planInfo.locked) return null;

  // Plus trial: compact variant
  if (plan === 'plus' && isTrialing) {
    if (!planInfo.upgradeProUrl) return null;
    return (
      <SettingsSection label="Want more?">
        <a
          href={planInfo.upgradeProUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Upgrade to Pro
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </SettingsSection>
    );
  }

  const nextTierFeatures = getNextTierFeatures(plan, features);
  if (nextTierFeatures.length === 0) return null;

  const isFreePlan = plan === 'free';
  const label = isFreePlan ? 'Unlock with Plus' : 'Unlock with Pro';
  const upgradeHref = isFreePlan ? (planInfo.upgradePlusUrl ?? planInfo.upgradeUrl) : planInfo.upgradeProUrl;

  return (
    <SettingsSection label={label}>
      <ul className="flex flex-col gap-1.5 mb-3">
        {nextTierFeatures.map((feat) => (
          <li key={feat} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <span className="text-[var(--color-success)]">&#10003;</span>
            {feat}
          </li>
        ))}
      </ul>
      {upgradeHref && isSafeExternalUrl(upgradeHref) && (
        <a
          href={upgradeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={actionSecondary}
        >
          {isFreePlan ? 'Upgrade to Plus' : 'Upgrade to Pro'}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </SettingsSection>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function SubscriptionSection() {
  const { planInfo, isSelfHosted, isLocked, isLoading, refresh, refreshUsage, usage } = usePlan();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();

  // Handle return from external payment page via URL params
  useEffect(() => {
    if (handledRef.current) return;
    const status = searchParams.get('subscription');
    if (!status) return;
    handledRef.current = true;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('subscription');
      return next;
    }, { replace: true });

    if (status === 'success') {
      const previousStatus = planInfo.status;
      let attempt = 0;
      const poll = () => {
        if (attempt >= 15) return;
        attempt++;
        pollRef.current = setTimeout(async () => {
          const updated = await refresh();
          if (updated && updated.status !== previousStatus) {
            showToast({ message: 'Subscription updated successfully', variant: 'success' });
          } else {
            poll();
          }
        }, 3000);
      };
      poll();
    } else if (status === 'cancelled') {
      showToast({ message: 'Subscription update was cancelled', variant: 'default' });
    }

    return () => clearTimeout(pollRef.current);
  }, [searchParams, setSearchParams, showToast, refresh, planInfo.status]);

  // Refetch plan + usage when page regains visibility
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        refreshUsage();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, refreshUsage]);

  const [downgrading, setDowngrading] = useState(false);
  const handleDowngradeToFree = useCallback(async () => {
    setDowngrading(true);
    try {
      await apiFetch('/api/plan/downgrade-to-free', { method: 'POST' });
      await refresh();
      refreshUsage();
      showToast({ message: 'Switched to the Free plan', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to switch to Free plan', variant: 'error' });
    } finally {
      setDowngrading(false);
    }
  }, [refresh, refreshUsage, showToast]);

  if (isSelfHosted || isLoading) return null;

  const isFree = planInfo.plan === 'free';
  const isTrialing = planInfo.status === 'trial';
  const tiles = buildUsageTiles(planInfo, usage);
  const showBilling = !isFree || isTrialing;

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Subscription</h2>
        <p className="text-[13px] text-[var(--text-tertiary)]">Manage your plan and billing.</p>
      </div>

      {/* Locked warning banner */}
      {isLocked && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-3 mb-5 bg-[var(--destructive-soft)] text-[var(--destructive)]">
          <Clock className="h-4 w-4 shrink-0" />
          <p className="text-[13px] font-medium">{getLockedMessage(planInfo.previousSubStatus)}</p>
        </div>
      )}

      {/* Plan header */}
      <PlanHeader planInfo={planInfo} isLocked={isLocked} />

      {/* Usage warnings (contextual) */}
      <UsageWarnings tiles={tiles} />

      {/* Unlock next tier */}
      <UnlockSection planInfo={planInfo} />

      {/* Billing */}
      {showBilling && (
        <SettingsSection label="Billing">
          {planInfo.portalUrl && isSafeExternalUrl(planInfo.portalUrl) && (
            <SettingsRow
              label="Manage Subscription"
              description="Update payment method, view invoices, or cancel"
              onClick={() => window.open(planInfo.portalUrl!, '_blank', 'noopener,noreferrer')}
            />
          )}
          {planInfo.canDowngradeToFree && (
            <button
              type="button"
              disabled={downgrading}
              onClick={handleDowngradeToFree}
              className="mt-2 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
            >
              {isLocked ? 'Continue with Free Plan' : 'Switch to Free Plan'}
            </button>
          )}
        </SettingsSection>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: All 13 tests PASS (4 existing + 9 new).

- [ ] **Step 3: Run type check**

Run: `cd /home/akifbayram/qrcode && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 4: Run biome check**

Run: `cd /home/akifbayram/qrcode && npx biome check src/ee/SubscriptionSection.tsx`

Expected: No lint or format errors. If there are, fix them.

- [ ] **Step 5: Commit**

```bash
git add src/ee/SubscriptionSection.tsx
git commit -m "feat: redesign subscription page with plan header and contextual sections"
```

---

## Task 7: Verify all tests pass and fix any regressions

**Files:**
- Modify (if needed): `src/ee/SubscriptionSection.tsx`
- Modify (if needed): `src/ee/__tests__/SubscriptionSection.test.tsx`

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/akifbayram/qrcode && npx vitest run src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: All 13 tests PASS.

- [ ] **Step 2: Run the full project type check**

Run: `cd /home/akifbayram/qrcode && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run biome on both files**

Run: `cd /home/akifbayram/qrcode && npx biome check src/ee/SubscriptionSection.tsx src/ee/__tests__/SubscriptionSection.test.tsx`

Expected: Clean.

- [ ] **Step 4: Build check**

Run: `cd /home/akifbayram/qrcode && npx vite build`

Expected: Build succeeds. The component is lazy-loaded via `__EE__` guard in `App.tsx`, so it must be tree-shakeable.

- [ ] **Step 5: Commit any fixes (if needed)**

```bash
git add -u
git commit -m "fix: address subscription page test regressions"
```

Only commit if changes were needed. Skip if all passed clean.

---

## Task 8: Remove unused imports from old component

After the rewrite, the old imports (`Card`, `CardContent`, `Disclosure`) are no longer used. Verify they were removed in Task 6.

**Files:**
- Verify: `src/ee/SubscriptionSection.tsx`

- [ ] **Step 1: Verify no unused imports remain**

Run: `cd /home/akifbayram/qrcode && npx biome check src/ee/SubscriptionSection.tsx`

The Task 6 implementation already removed `Card`, `CardContent`, and `Disclosure` imports. If biome reports unused imports, remove them.

Expected: Clean — no action needed if Task 6 was applied correctly.

- [ ] **Step 2: Commit if any cleanup was needed**

```bash
git add src/ee/SubscriptionSection.tsx
git commit -m "refactor: remove unused imports from subscription section"
```

Only commit if changes were made. Skip otherwise.
