# Subscription Page Redesign

## Problem

The subscription page (`src/ee/SubscriptionSection.tsx`) is the old card-based component dropped into the settings layout. It renders as a `<Card>` with a `<Disclosure>` accordion — not a proper settings page. The page needs to match the settings page patterns (like `AccountSection`) while providing state-adaptive content for different user plan states.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Billing detail | Status + actions only | Stripe portal handles billing history, invoices, payment methods. Industry standard (Linear, Vercel, Notion). |
| Usage metrics | Contextual — show only when near/over limits | Keeps page clean when healthy. Warnings surface when they matter. |
| State adaptation | Minimal for active subscribers, promotional for free/trial | Active Pro users don't need upgrade CTAs. Free users benefit from seeing what they'd unlock. |
| Upgrade pitch | Current plan + next tier only | Full comparison tables belong on marketing pages, not in-app settings. |
| Layout approach | Plan header + contextual `SettingsSection` sections | Plan identity gets visual prominence. Supporting content uses existing settings patterns. |

## Page Structure

### Page Header

Standard settings header matching `AccountSection`:

```
Subscription
Manage your plan and billing.
```

### Locked Warning Banner (conditional: `isLocked`)

Rendered between page header and plan header. Destructive-tinted banner with `Clock` icon and message from `getLockedMessage(previousSubStatus)`.

### Plan Header Block

Distinct block with `bg-[var(--bg-input)]` and `rounded-[var(--radius-md)]` — not wrapped in `SettingsSection`.

Contents:
- **Plan name**: 18-20px bold text — "Free Plan", "Plus Plan", "Pro Plan"
- **Status badge**: green "Active" (`--color-success`), amber "Trial" (`--color-warning`), red "Expired" (`--destructive`)
- **Plan subtitle**: summary of current plan limits/features
  - Free: "50 bins · 1 location"
  - Plus: "500 bins · AI credits · Custom fields"
  - Pro: "Unlimited · All features"
- **Trial countdown** (conditional: `isTrialing`): "{days} days remaining" in warning color
- **Primary CTA** (conditional: not active paid): "Upgrade" (free), "Subscribe to {Plan}" (trial), "Resubscribe" (locked). Opens external URL in new tab. No CTA for active paid users.

### Usage Warnings (conditional: any metric near or over limit)

`SettingsSection` with label "Usage". Only rendered when at least one usage metric exceeds 80% of its limit or is over limit.

Each warning is a row showing:
- Resource name + current/limit values
- Near limit (>80%): amber text with `--color-warning`
- Over limit: red text with `--destructive`, " — Over limit" suffix

Uses existing `buildUsageTiles()` logic, filtered to tiles where `used/limit >= 0.8` or `isOver`.

### Unlock Next Tier (conditional: free users, active Plus users)

`SettingsSection` with dynamic label: "Unlock with Plus" (free) or "Unlock with Pro" (Plus).

Not shown for: Pro users (active or trial), locked users (they need to resubscribe, not upgrade).

**Full feature list variant** (free users, active Plus users):
- Feature list derived from `getNextTierFeatures(currentPlan, currentFeatures)` — a pure function mapping feature keys to human-readable descriptions
- Secondary-styled upgrade button linking to `upgradePlusUrl` or `upgradeProUrl`

**Compact variant** (Plus trial users):
- Single inline row: "Want more? Upgrade to Pro" link pointing to `upgradeProUrl`
- No feature list — they already have Plus features and are focused on subscribing

Feature descriptions (hardcoded mapping):

| Feature Key | Free -> Plus | Plus -> Pro |
|------------|-------------|-------------|
| `maxBins` | "Up to 500 bins" | "Unlimited bins" |
| `ai` | "AI-powered features" | — (already has) |
| `customFields` | "Custom fields" | — |
| `fullExport` | "Full data export" | — |
| `apiKeys` | — | "API keys" |
| `reorganize` | — | "AI reorganization" |
| `binSharing` | — | "Bin sharing links" |
| `maxLocations` | — | "Unlimited locations" |
| `maxPhotoStorageMb` | — | "Expanded photo storage" |

### Billing (conditional: has subscription — trial or active paid)

`SettingsSection` with label "Billing".

Not shown for: free users (no subscription to manage).

Contents:
- "Manage Subscription" link → `portalUrl`, opens external. Styled as a `SettingsRow` with chevron.
- "Switch to Free Plan" / "Continue with Free Plan" (conditional: `canDowngradeToFree`). Styled as subtle text link, matching current downgrade button.

## State Matrix

| User State | Locked Banner | Plan Header CTA | Usage Warnings | Unlock Section | Billing Section |
|------------|--------------|-----------------|----------------|---------------|----------------|
| Free | — | "Upgrade" | If near/over | "Unlock with Plus" | — |
| Plus Trial | — | "Subscribe to Plus" | If near/over | Compact "Upgrade to Pro" link | Switch to Free |
| Pro Trial | — | "Subscribe to Pro" | If near/over | — | Switch to Free |
| Active Plus | — | — | If near/over | "Unlock with Pro" | Manage + Switch to Free |
| Active Pro | — | — | If near/over | — | Manage |
| Locked (post-trial) | Yes | "Subscribe" | If over | — | Continue with Free |
| Locked (post-active) | Yes | "Resubscribe" | If over | — | Continue with Free |

## Component Architecture

### File: `src/ee/SubscriptionSection.tsx`

Single file, refactored in place. No new files.

**Exported:** `SubscriptionSection` (named export, as today)

**Internal sub-components** (not exported):
- `PlanHeader` — plan name, badge, subtitle, CTA
- `UsageWarnings` — filtered usage tiles with warning styling
- `UnlockSection` — next-tier feature list + upgrade button

**Preserved logic** (moved from old component, not rewritten):
- `buildUsageTiles()` — reused, with added near-limit filtering
- `buildActions()` — reused for primary CTA URL resolution
- Payment return polling (`useEffect` with `?subscription=` URL param)
- Visibility change refresh (`visibilitychange` event listener)
- `handleDowngradeToFree` callback
- Self-hosted / loading early returns

**New logic:**
- `getNextTierFeatures(plan: PlanTier, features: PlanFeatures): string[]` — pure function returning human-readable feature descriptions for the next tier
- `isNearLimit(tile: UsageTile): boolean` — checks if usage is >80% of limit
- Near-limit threshold constant: `NEAR_LIMIT_THRESHOLD = 0.8`

### Design Token Usage

- Backgrounds: `var(--bg-input)` for plan header block
- Borders: `var(--border-flat)` for structural borders, `var(--border-subtle)` for internal separators
- Status colors: `var(--color-warning)` / `var(--color-warning-soft)` for trial/near-limit, `var(--destructive)` / `var(--destructive-soft)` for locked/over-limit, success tokens for active badge
- Radius: `var(--radius-md)` for plan header, `var(--radius-sm)` for badges
- Typography: standard settings page sizes (20px page title, 15px section labels, 13-14px body)

### Shared Utilities Used

- `cn()` from `lib/utils.ts`
- `focusRing` from `lib/utils.ts`
- `SettingsSection` from `features/settings/SettingsSection`
- `SettingsRow` from `features/settings/SettingsRow` (for Manage Subscription link)
- `Button` from `components/ui/button`
- Icons: `ArrowUpRight`, `Clock`, `AlertTriangle` from `lucide-react`

## Testing

File: `src/ee/__tests__/SubscriptionSection.test.tsx`

### Existing Tests (preserved, behavior unchanged)

1. Shows "Switch to Free Plan" for trial user with `canDowngradeToFree=true`
2. Shows "Continue with Free Plan" for locked post-trial with `canDowngradeToFree=true`
3. Does not show downgrade when `canDowngradeToFree=false`
4. Shows single "Upgrade" button for free plan users

### New Tests

5. **Usage warnings hidden when under limits** — render with usage well under limits, assert no "Over limit" or warning text
6. **Usage warnings shown when over limit** — render with `binCount > maxBins`, assert warning row appears
7. **Unlock section shown for free users** — render as free, assert "Unlock with Plus" section present
8. **Unlock section shown for active Plus** — render as active Plus with `upgradeProUrl`, assert "Unlock with Pro" present
9. **Unlock section hidden for Pro users** — render as active Pro, assert no unlock section
10. **Locked banner shown when locked** — render with `locked: true`, assert warning banner text
11. **Locked banner hidden when not locked** — render active Plus, assert no warning banner
12. **Plan header shows trial badge** — render trial, assert "Trial" badge visible
13. **Plan header shows active badge** — render active, assert "Active" badge visible

## Out of Scope

- Billing history, invoices, payment method display (stays in Stripe portal)
- Feature comparison table / pricing page
- New API endpoints
- Changes to `usePlan()` or `PlanInfo` types
- Server-side changes
