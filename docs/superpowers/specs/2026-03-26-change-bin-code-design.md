# Change Bin Code (QR/Shortcode Reassignment)

**Date:** 2026-03-26
**Status:** Approved

## Problem

Users attach sticky QR labels to physical storage bins. These labels are not easily removed. When a user wants to repurpose a physical bin, they need the app to update which logical bin a printed QR code/shortcode points to — rather than peeling off the old label and printing a new one.

## Solution

Allow users to change a bin's shortcode (which is also its primary key) via a primary-key swap in a single database transaction. Two UI entry points support both directions: adopting a code onto a target bin, or reassigning a code away from the current bin to another.

## Architecture

### Current State

- Bin `id` (TEXT PRIMARY KEY) is the 6-char shortcode (e.g., "TBXABC"). There is no separate `short_code` column.
- QR codes encode `openbin://bin/{id}` or `{BASE_URL}/bin/{id}` depending on `QR_PAYLOAD_MODE`.
- Short codes are auto-generated from bin names via `generateShortCode()` in `server/src/lib/shortCode.ts`.
- The `id` is referenced as a foreign key by: `bin_items`, `photos`, `bin_custom_field_values`, `pinned_bins`, `scan_history`. Also referenced (non-FK) by `activity_log.entity_id`.

### API

**Endpoint:** `POST /api/bins/:id/change-code`

**Request body:**
```json
{ "code": "ABCDEF" }
```

**Authorization:** Member+ role in the target bin's location. If the code belongs to a bin in a different location, member+ in that location too.

**Response:** `200 OK` with the updated bin object (new `id` reflected).

**Error responses:**
- `400` — Invalid code format
- `400` — Code is same as current bin ID
- `403` — Insufficient permissions (in either location for cross-location)
- `404` — Target bin not found

### Database Transaction

```sql
BEGIN;
PRAGMA defer_foreign_keys = ON;

-- 1. If code belongs to an existing bin, soft-delete it
UPDATE bins SET deleted_at = datetime('now') WHERE id = :newCode AND deleted_at IS NULL;
-- If code belongs to a trashed bin, permanently delete it
DELETE FROM bins WHERE id = :newCode AND deleted_at IS NOT NULL;

-- 2. Update all FK references from target bin's current ID to new code
UPDATE bin_items SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE photos SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE bin_custom_field_values SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE pinned_bins SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE scan_history SET bin_id = :newCode WHERE bin_id = :targetId;

-- 3. Update activity log references (not a true FK)
UPDATE activity_log SET entity_id = :newCode
  WHERE entity_id = :targetId AND entity_type = 'bin';

-- 4. Change the bin's primary key
UPDATE bins SET id = :newCode, updated_at = datetime('now') WHERE id = :targetId;

COMMIT;
```

`PRAGMA defer_foreign_keys = ON` defers FK constraint checks to commit time, allowing the FK references and primary key to be updated in any order within the transaction.

### Activity Logging

- Log a `code_changed` action on the target bin: `changes: { code: { old: "XYZABC", new: "ABCDEF" } }`
- If an existing bin was soft-deleted, log `bin_deleted` action (existing behavior via soft-delete logic)

## UI/UX

### Direction 1: "Change Code" (adopt a code onto this bin)

**Entry point:** Bin detail toolbar, alongside Edit/Print buttons. Visible to member+ role.

**Flow:**
1. User clicks "Change Code" button in toolbar
2. Dialog opens with two input modes (toggle): **Scan QR** | **Enter Code**
3. Scan mode reuses the existing `html5-qrcode` scanner (dynamic import)
4. Manual mode: text input, auto-uppercased, 4-8 char alphanumeric validation
5. After entering a code, dialog shows confirmation:
   - **Code is claimed:** "Code ABCDEF belongs to 'Old Bin Name'. Adopting it will delete that bin and change this bin's code from XYZABC to ABCDEF."
   - **Code is unclaimed:** "Change this bin's code from XYZABC to ABCDEF?"
6. On confirm: API call, toast "Code changed to ABCDEF", URL updates via `navigate(/bin/ABCDEF, { replace: true })`

### Direction 2: "Reassign Code" (give this bin's code to another bin)

**Entry point:** Bin detail overflow menu (alongside Move, Delete). Visible to member+ role.

**Flow:**
1. User clicks "Reassign Code" in overflow menu
2. Dialog opens with same input modes: **Scan QR** | **Enter Code**
3. Prompt: "Which bin should receive code OLDCODE?"
4. User enters/scans the target bin's code
5. Confirmation: "Code OLDCODE will move to 'Target Bin'. This bin ('Current Bin') will be deleted."
6. On confirm: API call (target is the entered bin), navigate to `/bin/OLDCODE` (which now points to target bin)

### Shared Dialog Component

Both directions use a single `ChangeCodeDialog` component with a `mode: 'adopt' | 'reassign'` prop. The prop controls:
- Dialog title and description copy
- Which bin is the "target" in the API call
- Which bin gets deleted
- Post-success navigation destination

## Validation & Edge Cases

### Input Validation
- Code must be 4-8 characters, alphanumeric (matches `BIN_URL_REGEX` capture group)
- Auto-uppercased on input and before API call
- Cannot adopt own current code (400 error)

### Cross-Location
- User must have member+ role in both locations
- Error if user lacks permission in the code's current location
- Activity log entries recorded in both locations

### Deleted/Trashed Bins
- Code belongs to a soft-deleted (trashed) bin: allow adoption, permanently delete the trashed bin
- Code is completely unclaimed (no bin row exists): allow adoption, no deletion needed — just the ID swap

### Conflict Guard
- Transaction is atomic — if state changes between lookup and confirm, the transaction handles it safely
- Unique constraint on `bins.id` prevents duplicate codes

### QR Cache
- Frontend QR data URL LRU cache is keyed by bin ID — old entries become stale naturally
- New ID generates a fresh QR on next render

### Navigation
- After adopt: `navigate(/bin/NEWCODE, { replace: true })` — back button won't hit dead URL
- After reassign: navigate to the target bin at its new code

## Files to Create/Modify

### Server
- `server/src/routes/bins.ts` — Add `POST /bins/:id/change-code` route
- `server/src/lib/binValidation.ts` — Add code format validation helper
- `server/openapi.yaml` — Document new endpoint

### Client
- `src/features/bins/ChangeCodeDialog.tsx` — New shared dialog component (scan + manual input, confirmation)
- `src/features/bins/useBins.ts` — Add `changeCode(binId, newCode)` mutation function
- `src/features/bins/BinDetailToolbar.tsx` — Add "Change Code" button
- `src/features/bins/BinDetailPage.tsx` — Wire up dialog state for both directions (toolbar + overflow menu)

### Tests
- `server/src/__tests__/changeCode.test.ts` — API endpoint tests (happy path, cross-location, validation, permissions)
- `src/features/bins/__tests__/ChangeCodeDialog.test.tsx` — Dialog rendering and mode behavior
