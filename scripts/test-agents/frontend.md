# OpenBin Frontend Reliability Test Agent

You are a Claude Code agent running an automated frontend test-gap analysis on the OpenBin codebase.
Your goal: find and write Vitest tests for hook error paths, event-bus refresh behavior, and component edge cases.

## Project Context

OpenBin is a React 18 + TypeScript app. Key patterns:
- Hooks use `apiFetch()` from `src/lib/api.ts` for data fetching
- `useListData`, `usePaginatedList`, `usePagedList` from `src/lib/useListQuery.ts` for list hooks
- Event bus: `notify()` and `useRefreshOn()` from `src/lib/eventBus.ts` — 13 event types
- Auth: `useAuth()` from `src/lib/auth.tsx`
- Tests use Vitest + happy-dom, mock `apiFetch` and `useAuth`

## Read These Files First

1. `src/lib/useListQuery.ts` — `useListData`, `usePaginatedList`, `usePagedList`
2. `src/lib/eventBus.ts` — all 13 event type names and the `notify`/`useRefreshOn` API
3. `src/lib/__tests__/eventBus.test.ts` — what is already covered
4. `src/features/bins/__tests__/useBins.test.ts` — the mock pattern (study this carefully)
5. `src/lib/__tests__/usePermissions.test.ts` — the `renderHook` pattern
6. `src/features/bins/__tests__/useBinList.test.ts` — existing list hook tests

## Test Patterns

**Mock setup (copy this exactly):**
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ activeLocationId: 'test-location', token: 'test-token' }),
}));

import { apiFetch } from '@/lib/api';
const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => { vi.clearAllMocks(); });
```

**Testing a hook with renderHook:**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useSomeHook } from '../useSomeHook';

it('returns error state when API fails', async () => {
  mockApiFetch.mockRejectedValue(new Error('Network error'));
  const { result } = renderHook(() => useSomeHook('loc-1'));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBeTruthy();
});
```

## Mandate: What to Test

### 1. useListQuery hook states — create `src/lib/__tests__/useListQuery.test.ts`

Read `src/lib/useListQuery.ts` first. For each of `useListData`, `usePaginatedList`, and `usePagedList`, write tests:
- **Loading state**: mock `apiFetch` with a promise that never resolves; assert `isLoading` is `true` immediately after render
- **Success state**: mock `apiFetch` to resolve with `{ results: [{ id: '1', name: 'Test' }], count: 1 }`; assert `isLoading` becomes `false` and data contains the item
- **Error state**: mock `apiFetch` to reject with `new Error('fail')`; assert `isLoading` becomes `false` and `error` is set (or data is empty, per the hook's contract — check the source)
- **Empty results**: mock `apiFetch` to resolve with `{ results: [], count: 0 }`; assert data is an empty array (not undefined or null)
- **Null path guard**: call the hook with `null` as the path; assert `apiFetch` is never called

### 2. Event bus: all 13 event types trigger refetches — create `src/lib/__tests__/eventBusRefresh.test.ts`

The 13 event types are defined in `src/lib/eventBus.ts`. Read that file to get the exact constant names.

For each event type, find which hook subscribes to it by grepping for `useRefreshOn` across `src/`. Write a test that:
1. Renders the hook that subscribes to that event type
2. Waits for the initial fetch to complete
3. Calls `notify(EVENT_TYPE)` 
4. Asserts `apiFetch` was called a second time (a refresh happened)

The event types are: `BINS`, `LOCATIONS`, `PHOTOS`, `PINS`, `AREAS`, `TAG_COLORS`, `SCAN_HISTORY`, `CUSTOM_FIELDS`, `PLAN`, `CHECKOUTS`, `BIN_USAGE`, `ATTACHMENTS`, `SHOPPING_LIST`.

Read `src/lib/__tests__/eventBus.test.ts` first — only write tests for event types NOT already covered there.

### 3. usePermissions exhaustive matrix — extend `src/lib/__tests__/usePermissions.test.ts`

Read the existing file first to see which combinations are already tested. Write the missing cases:
- `viewer` role: `canWrite` is false, `canCreateBin` is false, `canPin` is false, `canEditBin('any-user-id')` is false, `canDeleteBin('any-user-id')` is false, `canManageMembers` is false
- `member` role: `canWrite` is true, `canCreateBin` is true, `canEditBin(ownUserId)` is true, `canEditBin('other-user-id')` is false, `canManageMembers` is false, `canManageAreas` is false
- No active location (activeLocationId is null): all permissions return false
- No user logged in (user is null): all permissions return false

### 4. Component edge cases

Read existing component tests first. Write only for gaps:

**Extend `src/features/bins/__tests__/ItemList.test.tsx`:**
- Renders without crash when an item's name is 500 characters long
- Renders the empty state (no crash, no undefined errors) when `items` is an empty array
- Renders correctly when an item has `quantity: null` vs `quantity: 0` (both should display without crash)

**Extend `src/features/bins/__tests__/BinCreateForm.test.tsx`:**
- Submitting with an empty name field does NOT call `apiFetch` (client-side guard)
- Submitting a valid form calls `apiFetch` exactly once with `method: 'POST'`

## Self-Validation Gate

After writing each test file, run from the project root:
```bash
npx vitest run src/lib/__tests__/useListQuery.test.ts
npx vitest run src/lib/__tests__/eventBusRefresh.test.ts
npx vitest run src/lib/__tests__/usePermissions.test.ts
```
Fix all failures. Do not leave failing tests.

## Output Summary

At the end, print:
```
## Frontend Agent Summary
Files created: [list]
Files extended: [list]
New test cases: [count]
Gaps not covered: [explain any — e.g., needs browser for camera APIs]
```
