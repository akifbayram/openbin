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
- The `id` is referenced as a foreign key by: `bin_items`, `photos`, `bin_custom_field_values`, `pinned_bins`, `scan_history`. All FKs specify `ON DELETE CASCADE` but NOT `ON UPDATE CASCADE`.
- `activity_log.entity_id` references bin IDs but is not a FK constraint.
- Photos are stored on disk at `PHOTO_STORAGE_PATH/{binId}/{uuid}.ext`. The `photos` table has `storage_path` and `thumb_path` columns containing the bin ID as a path component.
- Bin deletion requires admin role (`requireAdmin` middleware on `DELETE /api/bins/:id`).

### API

**Endpoint:** `POST /api/bins/:id/change-code`

`:id` is always the bin whose code will change (the "target" bin — the one that survives).

**Request body:**
```json
{ "code": "ABCDEF" }
```

`code` is the new code to adopt. If this code currently belongs to another bin, that bin is permanently deleted.

**Authorization:** Admin role in the target bin's location (since the operation can delete another bin). If the code belongs to a bin in a different location, admin in that location too.

**Response:** `200 OK` with the updated bin object (new `id` reflected).

**Error responses:**
- `422` — Invalid code format (via `ValidationError`)
- `422` — Code is same as current bin ID
- `403` — Insufficient permissions (not admin in either location)
- `404` — Target bin (`:id`) not found
- `409` — Conflict (concurrent modification, via `ConflictError`)

**Rate limiting:** Apply `sensitiveAuthLimiter` as route-level middleware in `bins.ts` (e.g., `router.post('/:id/change-code', sensitiveAuthLimiter, asyncHandler(...))`).

### API Call Examples

**Direction 1 — Adopt:** User is on bin XYZABC and wants to take code ABCDEF.
```
POST /api/bins/XYZABC/change-code
{ "code": "ABCDEF" }
```
Result: bin XYZABC becomes ABCDEF. The bin that previously had code ABCDEF is deleted.

**Direction 2 — Reassign:** User is on bin OLDBIN and wants to give its code to bin TGTBIN.
```
POST /api/bins/TGTBIN/change-code
{ "code": "OLDBIN" }
```
Result: bin TGTBIN becomes OLDBIN. The original OLDBIN (the one the user was viewing) is deleted. The client constructs this call by swapping which bin is `:id` and which is `code`.

### Pre-Transaction Setup

Before starting the transaction, if `newCode` belongs to an existing bin:

1. **Fetch the existing bin's metadata** — query `SELECT id, name, location_id FROM bins WHERE id = :newCode` (WITHOUT `deleted_at IS NULL` filter, so trashed bins are included). Store `oldBinName` and `oldBinLocationId` for post-transaction activity logging.
2. **Fetch the existing bin's photo paths** — query `SELECT storage_path, thumb_path FROM photos WHERE bin_id = :newCode`. Store these for post-transaction disk cleanup, since `ON DELETE CASCADE` will remove these rows during the transaction.

### Database Transaction

```sql
BEGIN;
-- defer_foreign_keys is required because steps 2-4 update child rows
-- to reference :newCode before step 5 creates the parent row with that ID.
-- Without deferral, SQLite would reject the UPDATEs due to FK violations.
-- This is the first use of defer_foreign_keys in the codebase.
PRAGMA defer_foreign_keys = ON;

-- 1. If code belongs to an existing bin, hard-delete it.
--    ON DELETE CASCADE removes its bin_items, photos (DB rows),
--    bin_custom_field_values, pinned_bins, and scan_history.
DELETE FROM bins WHERE id = :newCode;

-- 2. Update all FK references from target bin's current ID to new code
UPDATE bin_items SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE photos SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE bin_custom_field_values SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE pinned_bins SET bin_id = :newCode WHERE bin_id = :targetId;
UPDATE scan_history SET bin_id = :newCode WHERE bin_id = :targetId;

-- 3. Update photo storage paths to reflect new directory
UPDATE photos SET
  storage_path = replace(storage_path, :targetId || '/', :newCode || '/'),
  thumb_path = CASE WHEN thumb_path IS NOT NULL
    THEN replace(thumb_path, :targetId || '/', :newCode || '/')
    ELSE NULL END
WHERE bin_id = :newCode;

-- 4. Update activity log references (not a true FK)
UPDATE activity_log SET entity_id = :newCode
  WHERE entity_id = :targetId AND entity_type = 'bin';

-- 5. Change the bin's primary key
UPDATE bins SET id = :newCode, updated_at = datetime('now') WHERE id = :targetId;

COMMIT;
```

### Photo File Handling (Post-Transaction)

After the transaction commits successfully:

1. **Clean up deleted bin's photos:** Using the photo paths fetched in the pre-transaction step, delete each file from disk (both `storage_path` and `thumb_path`), then remove the directory at `PHOTO_STORAGE_PATH/{newCode}` if it exists. The DB rows were already removed by `ON DELETE CASCADE` during the transaction.
2. **Rename target bin's photo directory:** If the target bin has photos, rename `PHOTO_STORAGE_PATH/{targetId}` to `PHOTO_STORAGE_PATH/{newCode}`.
3. **Error recovery:** If the directory rename fails (e.g., permissions), log the error but don't roll back the transaction — the `storage_path` columns already point to the new directory, so a retry or manual fix is possible.

The disk operations happen AFTER the transaction to avoid partial state if the transaction fails.

### Activity Logging

All activity logging happens after the transaction commits successfully (matching the pattern used by `DELETE /api/bins/:id/permanent`). This avoids spurious log entries if the transaction fails.

- If an existing bin was deleted: log `bin_deleted` action using the `oldBinName` and `oldBinLocationId` fetched in the pre-transaction step.
- Log `code_changed` action with `entity_id = newCode`, `changes: { code: { old: "XYZABC", new: "ABCDEF" } }` in the target bin's location.

## UI/UX

### Direction 1: "Change Code" (adopt a code onto this bin)

**Entry point:** Bin detail overflow menu (alongside Move, Delete). Visible to admin role only.

**Flow:**
1. User clicks "Change Code" in overflow menu
2. Dialog opens with two input modes (toggle): **Scan QR** | **Enter Code**
3. Scan mode reuses the existing `html5-qrcode` scanner (dynamic import, lazy-loaded only when scan tab is selected)
4. Manual mode: text input, auto-uppercased, 4-8 char alphanumeric validation
5. After entering a code, dialog shows confirmation:
   - **Code is claimed:** "Code ABCDEF belongs to 'Old Bin Name'. Adopting it will permanently delete that bin and change this bin's code from XYZABC to ABCDEF."
   - **Code is unclaimed:** "Change this bin's code from XYZABC to ABCDEF?"
6. On confirm: API call, toast "Code changed to ABCDEF", URL updates via `navigate(/bin/ABCDEF, { replace: true })`

### Direction 2: "Reassign Code" (give this bin's code to another bin)

**Entry point:** Bin detail overflow menu (alongside Move, Delete). Visible to admin role only.

**Flow:**
1. User clicks "Reassign Code" in overflow menu
2. Dialog opens with same input modes: **Scan QR** | **Enter Code**
3. Prompt: "Which bin should receive code OLDCODE?"
4. User enters/scans the target bin's code
5. Confirmation: "Code OLDCODE will move to 'Target Bin'. This bin ('Current Bin') will be permanently deleted."
6. On confirm: client calls `POST /api/bins/{targetBinCode}/change-code { code: "OLDCODE" }` (note the inversion — the entered bin becomes `:id`). Navigate to `/bin/OLDCODE` (which now points to the target bin).

### Shared Dialog Component

Both directions use a single `ChangeCodeDialog` component with a `mode: 'adopt' | 'reassign'` prop. The prop controls:
- Dialog title and description copy
- Which bin is `:id` and which is `code` in the API call
- Confirmation message wording (which bin gets deleted)
- Post-success navigation destination

## Validation & Edge Cases

### Input Validation
- Code must be 4-8 characters, alphanumeric `[A-Z0-9]` (matches `BIN_URL_REGEX` capture group). This is intentionally broader than the auto-generated charset (letters only, no I/L/O/S/Z) to support codes from external sources or older versions.
- Auto-uppercased on input and before API call
- Cannot adopt own current code (422 error)

### Cross-Location
- User must have admin role in both locations
- Error if user lacks admin in the code's current location
- Activity log entries recorded in both locations

### Deleted/Trashed Bins
- When looking up whether `newCode` belongs to an existing bin, query WITHOUT the `deleted_at IS NULL` filter so that trashed bins are also found and cleaned up.
- Code belongs to any existing bin row (including trashed): hard-delete it. `ON DELETE CASCADE` handles child rows.
- Code is completely unclaimed (no bin row exists): no deletion needed — just the FK update + ID change.

### Conflict Guard
- Transaction is atomic — if state changes between lookup and confirm, the transaction handles it safely
- Unique constraint on `bins.id` prevents duplicate codes
- Use `ConflictError` (409) if the target bin was modified between validation and execution

### QR Cache
- Frontend QR data URL LRU cache is keyed by bin ID — old entries become stale naturally
- New ID generates a fresh QR on next render

### Navigation
- After adopt: `navigate(/bin/NEWCODE, { replace: true })` — back button won't hit dead URL
- After reassign: navigate to the target bin at its new code

### Event Bus
- Fire `Events.BINS`, `Events.PINS`, and `Events.SCAN_HISTORY` after a successful code change to refresh all dependent UI components.

### Export Compatibility
- `ExportBinV2` includes a `shortCode` field. Exports made before a code change will contain the old code. This is a known limitation — the export reflects the bin's code at export time.

### `saved_views` Table
- Not affected. The `saved_views` table stores search queries, sort, and filters as text — none reference bin IDs directly.

## Files to Create/Modify

### Server
- `server/src/routes/bins.ts` — Add `POST /bins/:id/change-code` route with `requireAdmin`, `sensitiveAuthLimiter`
- `server/src/lib/binValidation.ts` — Add code format validation helper
- `server/openapi.yaml` — Document new endpoint

### Client
- `src/features/bins/ChangeCodeDialog.tsx` — New shared dialog component (scan + manual input, confirmation)
- `src/features/bins/useBins.ts` — Add `changeCode(binId, newCode)` mutation function, fire BINS + PINS + SCAN_HISTORY events
- `src/features/bins/BinDetailPage.tsx` — Wire up dialog state for both directions in overflow menu

### Tests
- `server/src/__tests__/changeCode.test.ts` — API endpoint tests (happy path, cross-location, validation, permissions, photo handling)
- `src/features/bins/__tests__/ChangeCodeDialog.test.tsx` — Dialog rendering and mode behavior
