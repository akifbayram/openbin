# OpenBin Business Logic Test Agent

You are a Claude Code agent running an automated business-logic test-gap analysis on the OpenBin codebase.
Your goal: find and write Vitest tests that cover correctness gaps in core data flows.

## Project Context

OpenBin is an AI-powered bin inventory app. Data model: Location → Area → Bin → Items.
Backend: Express 4 + SQLite at `server/`. Frontend: React 18 + TypeScript at `src/`.
Bins support: soft delete (`deleted_at`), trash/restore, tags, custom fields, photos, QR codes.

## Read These Files First

1. `server/src/__tests__/helpers.ts` — `createTestUser`, `createTestLocation`, `createTestBin`, `createTestArea`, `joinTestLocation`
2. `server/src/__tests__/bins.test.ts` — existing bin tests (do not duplicate)
3. `server/src/__tests__/items.test.ts` — existing item tests
4. `server/src/__tests__/areas.test.ts` — existing area tests
5. `server/src/__tests__/export.test.ts` — existing export tests
6. `server/src/__tests__/batch.test.ts` — existing batch tests
7. `server/src/routes/bins.ts`, `server/src/routes/items.ts`, `server/src/routes/areas.ts`

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

**HTTP requests:**
```typescript
const res = await request(app)
  .post('/api/bins')
  .set('Authorization', `Bearer ${token}`)
  .send({ locationId: location.id, name: 'My Bin' });
expect(res.status).toBe(201);
expect(res.body.name).toBe('My Bin');
```

## Mandate: What to Test

### 1. Soft delete isolation — extend `server/src/__tests__/bins.test.ts` or create `server/src/__tests__/softDelete.test.ts`

Read existing tests first. Write tests for uncovered gaps:
- Deleted bin does NOT appear in `GET /api/bins?locationId=...` results
- Deleted bin DOES appear in `GET /api/bins/trash?locationId=...`
- Items of a deleted bin are not returned in any list endpoint
- `PUT /api/bins/:id` on a deleted bin returns 404
- Restoring a bin via `POST /api/bins/:id/restore` makes it visible in the normal list again

### 2. Area hierarchy edge cases — extend `server/src/__tests__/areas.test.ts` or create `server/src/__tests__/areaHierarchy.test.ts`

Read `server/src/__tests__/hierarchicalAreas.test.ts` first. Write for uncovered gaps:
- Deleting a parent area: what happens to child areas and their bins?
- Moving a bin to a nested child area
- `descendant_bin_count` on a parent area reflects bins in all child areas
- Renaming an area does not affect its children

### 3. Export/import round-trip — create `server/src/__tests__/exportImport.test.ts`

Read `server/src/__tests__/export.test.ts` first. Write a round-trip test:
- Create a location with bins, items, tags, custom fields, and areas
- Export via `GET /api/export?locationId=...` and capture the JSON
- Create a new location
- Import the captured JSON via `POST /api/import`
- Assert: bin count matches, item names match, tags match, areas match

### 4. Bulk operation edge cases — create `server/src/__tests__/bulkEdgeCases.test.ts`

Read `server/src/__tests__/batch.test.ts` first. Write for gaps:
- `POST /api/batch` with empty `operations` array → 200 with empty results (not 500)
- `POST /api/batch` with a mix of valid and invalid operations → partial success, errors reported per-operation
- Bulk delete: bins are soft-deleted, not hard-deleted; they appear in trash

### 5. AI flow edge cases — extend `server/src/__tests__/aiStream.test.ts` or create `server/src/__tests__/aiFlowEdgeCases.test.ts`

Read `server/src/__tests__/ai.test.ts` and `server/src/__tests__/aiStream.test.ts` first. Write for uncovered gaps:
- **Partial JSON streaming**: the AI endpoint returns partial JSON chunks mid-stream; assert the client parser does not crash and waits for the full response
- **Provider fallback**: if the configured provider returns a 500, the endpoint returns a meaningful error (not a raw 500 stack trace)
- **Credit exhaustion**: when the user has 0 AI credits remaining, the streaming endpoint returns 402 with `error: 'OVER_LIMIT'`

Read `server/src/lib/aiCaller.ts` and `server/src/lib/aiStreamHandler.ts` for the AI pipeline before writing these tests.

### 6. Backup/restore — extend `server/src/lib/__tests__/backup.test.ts`

Read the existing backup test first. Write for gaps:
- Backup produces a non-empty file at the configured path
- Restore from a valid backup file replaces the data
- Restore from a corrupted file returns a descriptive error (not a 500 crash)

## Self-Validation Gate

After writing each test file, run:
```bash
cd server && npx vitest run src/__tests__/<filename>.test.ts
```
Fix all failures. Do not leave failing tests.

## Output Summary

At the end, print:
```
## Business Logic Agent Summary
Files created: [list]
Files extended: [list]
New test cases: [count]
Gaps not covered: [explain any that need a live service or special env]
```
