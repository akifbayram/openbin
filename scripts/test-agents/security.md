# OpenBin Security Test Agent

You are a Claude Code agent running an automated security test-gap analysis on the OpenBin codebase.
Your goal: find and write Vitest tests that cover security enforcement gaps.

## Project Context

OpenBin is an AI-powered bin inventory app. Backend: Express 4 + SQLite at `server/`. Frontend: React 18 + TypeScript at `src/`.

Three-tier role system: `admin` > `member` > `viewer`. Viewers are read-only.
- Middleware: `requireMemberOrAbove()` blocks viewers from mutations
- CSRF: double-submit cookie pattern (`server/src/lib/csrf.ts`)
- API keys: `sk_openbin_` prefix, checked via dual-auth middleware

## Read These Files First

1. `server/src/__tests__/helpers.ts` — understand `createTestUser`, `createTestLocation`, `createTestBin`, `createTestArea`, `joinTestLocation`
2. `server/src/__tests__/auth.test.ts` — CSRF cookie helpers: `getCsrfCookie`, `cookiePost` pattern
3. `server/src/__tests__/binAccess.test.ts` — existing permission test pattern
4. `server/src/__tests__/csrf.test.ts` — existing CSRF tests (don't duplicate these)
5. `server/src/__tests__/locationAccess.test.ts` — existing location access tests
6. `server/src/routes/` — list all route files, read each to catalog endpoints and their middleware

## Test Patterns

**Server test setup:**
```typescript
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../db.js';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser, joinTestLocation } from './helpers.js';

let app: Express;
beforeEach(() => { app = createApp(); });
```

**Making a viewer:**
```typescript
const { token: adminToken } = await createTestUser(app);
const location = await createTestLocation(app, adminToken);
const { token: viewerToken, user: viewerUser } = await createTestUser(app);
await joinTestLocation(app, viewerToken, location.invite_code);
await query(
  "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
  [location.id, viewerUser.id]
);
```

**Asserting 403 for a mutation:**
```typescript
const res = await request(app)
  .post('/api/bins')
  .set('Authorization', `Bearer ${viewerToken}`)
  .send({ locationId: location.id, name: 'Test' });
expect(res.status).toBe(403);
```

Note: Bearer token auth bypasses CSRF — no `X-CSRF-Token` header needed for these viewer-blocking tests.

## Mandate: What to Test

### 1. Viewer mutation blocking — `server/src/__tests__/viewerMutationBlock.test.ts`

Read `server/src/routes/` and check which endpoints are NOT already covered by `binAccess.test.ts` / `locationAccess.test.ts`.
For each uncovered mutation endpoint, write a test that:
- Creates an admin, a location, and a viewer member
- Sends the mutation as the viewer
- Asserts `403`

Priority endpoints to check (add any others you find):
- `POST /api/bins` (create bin)
- `PUT /api/bins/:id` (update bin)
- `DELETE /api/bins/:id` (delete bin)
- `POST /api/bins/:id/items` (add item)
- `PUT /api/bins/:id/items/:itemId` (update item)
- `DELETE /api/bins/:id/items/:itemId` (delete item)
- `POST /api/locations/:id/areas` (create area)
- `PUT /api/locations/:id/areas/:areaId` (rename area)
- `DELETE /api/locations/:id/areas/:areaId` (delete area)
- `POST /api/bins/:id/photos` (upload photo)
- `PUT /api/locations/:id` (update location settings)
- `POST /api/bins/:id/pin` (pin bin)
- `POST /api/locations/:locationId/custom-fields` (create custom field)

### 2. Input validation edge cases — `server/src/__tests__/inputValidation.test.ts`

Test these inputs on bin name, item name, area name fields:
- Empty string `""` → assert 400
- String of 10,001 characters → assert 400 or check the validation limit in `server/src/lib/binValidation.ts`
- String with `<script>alert(1)</script>` → assert 200 and stored value equals the raw input (not escaped — that is the frontend's job)
- Filename with path traversal `../../etc/passwd` in photo upload → assert 400 or check it is sanitized

To find the actual validation limits, read `server/src/lib/binValidation.ts` and `server/src/lib/validation.ts` before writing the tests.

### 3. Rate limiter enforcement — `server/src/__tests__/rateLimiter.test.ts`

IMPORTANT: The OpenBin config object is frozen at module import time. Setting `process.env.DISABLE_RATE_LIMIT = 'false'` at test runtime will NOT work — the rate limiters are already initialized as no-ops.

Rate limiter tests require one of these approaches:
a) Use `vi.mock('../lib/rateLimiters.js', ...)` to replace the no-op limiters with real express-rate-limit instances
b) OR note in the output summary that rate limiter tests cannot be written without a dedicated test environment and skip this section

If you choose approach (a):
- Read `server/src/lib/rateLimiters.ts` to understand the limiter factory
- Mock the module to return real express-rate-limit instances with low limits (e.g., `max: 2`)
- Hit the auth endpoint 3 times and assert the 3rd response is 429
- Hit the register endpoint 3 times and assert the 3rd response is 429

If you cannot implement (a) cleanly, note in your output summary: "Rate limiter tests skipped — config is frozen at import time; requires vi.mock of rateLimiters module."

### 4. API key scope — `server/src/__tests__/apiKeyScope.test.ts`

Read `server/src/__tests__/apiKeys.test.ts` to see what is already covered.
Write tests for any uncovered gaps:
- A valid API key can read bins (`GET /api/bins?locationId=...`) → 200
- A valid API key cannot access admin endpoints (`GET /api/admin/users`) → 403 or 401
- An API key with wrong prefix (`sk_wrong_xxx`) is rejected → 401
- A revoked API key is rejected → 401

To create an API key in a test, read the existing `apiKeys.test.ts` for the creation flow.

## Self-Validation Gate

After writing each test file, run:
```bash
cd server && npx vitest run src/__tests__/<filename>.test.ts
```
Fix all failures before finishing. Do not leave failing tests.

## Output Summary

At the end, print:
```
## Security Agent Summary
Files created: [list]
Files extended: [list]
New test cases: [count]
Gaps not covered: [explain any that need a live service or special env]
```
