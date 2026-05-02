# OpenBin EE Test Agent

You are a Claude Code agent running an automated EE (enterprise edition) test-gap analysis on the OpenBin codebase.
Your goal: find and write Vitest tests for plan gating, checkout action safety, over-limit enforcement, and EE component fallbacks.

## Project Context

OpenBin has an open-core split: open-source core + proprietary EE code in `src/ee/` and `server/src/ee/`.
EE is enabled at build time via `__EE__` global. In tests, EE server routes are registered when the EE module is loaded.

Plan tiers: `free` | `plus` | `pro`. Gating middleware: `requirePlan()` in `server/src/middleware/requirePlan.ts`.
Billing: `CheckoutAction` shape — JWT must never appear in URL (must be in POST body `fields`).
Limits: bins, members per location, photo storage.

## Read These Files First

1. `server/src/__tests__/helpers.ts` — `createTestUser`, `createTestLocation`, `createTestBin`
2. `server/src/__tests__/plan.test.ts` — existing plan tests; learn how plan state is set in tests
3. `server/src/__tests__/planGate.test.ts` and `server/src/__tests__/planGating.test.ts` — existing gating tests
4. `server/src/__tests__/requirePlan.test.ts` — existing requirePlan tests
5. `server/src/middleware/requirePlan.ts` — understand `requirePlan()` and `actionAndUrl()` helper
6. `server/src/ee/routes/` — list all EE routes and their plan requirements
7. `src/types.ts` — `CheckoutAction`, `PlanInfo`, `PlanFeatures` interfaces
8. `src/ee/checkoutAction.tsx` — `CheckoutLink` component and `submitCheckoutAction()`
9. `vitest.config.ts` — how `__EE__` is injected and what the test environment default is

## Test Patterns

**Server test setup:**
```typescript
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => { app = createApp(); });
```

Note: Read `server/src/__tests__/plan.test.ts` to see how plan state is set for a user (likely via direct DB manipulation). Use that exact pattern.

**Frontend mock setup:**
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
  },
}));

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

import { apiFetch } from '@/lib/api';
const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => { vi.clearAllMocks(); });
```

## Mandate: What to Test

### 1. EE route plan gates — extend `server/src/__tests__/planGating.test.ts` or create `server/src/__tests__/eeRouteGating.test.ts`

Read `server/src/ee/routes/` to list all EE routes. Read the existing `planGating.test.ts` first.
For each EE route guarded by `requirePlan()` and NOT already covered in existing tests:
- Call it as a free-tier user → assert 402 with `error: 'PLAN_REQUIRED'` or `'OVER_LIMIT'`
- Call it as a paid-tier user (plus or pro) → assert NOT 402

Read `server/src/__tests__/plan.test.ts` to learn how to set a user's plan tier before the request.

### 2. CheckoutAction JWT safety — create `server/src/ee/__tests__/checkoutActionSafety.test.ts`

Call the endpoint that returns `PlanInfo` (read `server/src/ee/routes/` to find it) as an authenticated user.
Assert on the response body:
- `upgradeAction` is either `null` or `{ method: 'POST', url: string, fields: Record<string, string> }` where `url` does NOT contain any JWT characters (no base64url patterns like `eyJ`)
- `portalAction` is either `null` or `{ method: 'POST', ... }` where `url` does NOT contain `eyJ`
- `subscribePlanAction` if present and non-null: `method` is `'GET'` (the plans page is a static site)
- The legacy `upgradeUrl`, `portalUrl` fields do NOT contain JWT tokens (they should be static URLs)

To detect a JWT in a URL: check that the URL does not match `/eyJ[A-Za-z0-9_-]+/`.

### 3. Over-limit error paths — extend `server/src/__tests__/planGate.test.ts` or create `server/src/__tests__/overLimit.test.ts`

Read `server/src/lib/requirePlan.ts` and `server/src/lib/memberCounts.ts`. Write tests for:
- Creating a bin when the location is at the free-tier bin limit → 402 with `error: 'OVER_LIMIT'`
- Inviting a member when the location is at the member cap → 402
- Check `server/src/lib/config.ts` for the actual free-tier limits (`maxBins`, `maxMembersPerLocation`)

To trigger limits, create exactly N bins (where N is the free limit), then try to create one more. Use the plan state setup pattern from `plan.test.ts`.

### 4. EE component __EE__=false fallback — create `src/ee/__tests__/eeDisabled.test.ts`

Read `vitest.config.ts` to confirm `__EE__` defaults to `false` in the test environment.
Read `src/ee/` to find components that are conditionally exported based on `__EE__`.

For each EE component that renders as a no-op when `__EE__` is false:
```typescript
import { render } from '@testing-library/react';
import { TheEEComponent } from '@/ee/TheEEComponent';

it('renders null when __EE__ is false', () => {
  const { container } = render(<TheEEComponent />);
  expect(container.firstChild).toBeNull();
});
```

If `__EE__` is true in tests, note this in the output summary and skip this section.

## Self-Validation Gate

After writing each test file, run:
```bash
cd server && npx vitest run src/__tests__/<filename>.test.ts
# or for client-side EE tests, from project root:
npx vitest run src/ee/__tests__/<filename>.test.tsx
```
Fix all failures. Do not leave failing tests.

## Output Summary

At the end, print:
```
## EE Agent Summary
Files created: [list]
Files extended: [list]
New test cases: [count]
Gaps not covered: [explain any — e.g., needs Stripe webhook setup, __EE__ is true in tests]
```
