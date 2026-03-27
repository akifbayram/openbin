# Change Bin Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to change a bin's shortcode (primary key) so physical QR labels can be reused.

**Architecture:** Single new API endpoint `POST /api/bins/:id/change-code` performs a primary-key swap inside a SQLite transaction with `defer_foreign_keys`. A shared `ChangeCodeDialog` component supports both "adopt" and "reassign" directions via a `mode` prop.

**Tech Stack:** Express + better-sqlite3 (server), React + TypeScript (client), html5-qrcode (scanner)

**Spec:** `docs/superpowers/specs/2026-03-26-change-bin-code-design.md`

---

### Task 1: Server — Code format validation helper

**Files:**
- Modify: `server/src/lib/binValidation.ts`
- Test: `server/src/__tests__/changeCode.test.ts`

- [ ] **Step 1: Write failing tests for `validateCodeFormat`**

Create `server/src/__tests__/changeCode.test.ts`:

```ts
import { validateCodeFormat } from '../lib/binValidation.js';

describe('validateCodeFormat', () => {
  it('accepts valid 6-char uppercase codes', () => {
    expect(() => validateCodeFormat('ABCDEF')).not.toThrow();
  });

  it('accepts 4-char codes', () => {
    expect(() => validateCodeFormat('ABCD')).not.toThrow();
  });

  it('accepts 8-char codes', () => {
    expect(() => validateCodeFormat('ABCD1234')).not.toThrow();
  });

  it('accepts codes with digits', () => {
    expect(() => validateCodeFormat('ABC123')).not.toThrow();
  });

  it('rejects codes shorter than 4 chars', () => {
    expect(() => validateCodeFormat('ABC')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes longer than 8 chars', () => {
    expect(() => validateCodeFormat('ABCDEFGHI')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes with special characters', () => {
    expect(() => validateCodeFormat('ABC-DE')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects empty string', () => {
    expect(() => validateCodeFormat('')).toThrow('Code must be 4-8 alphanumeric characters');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/changeCode.test.ts`
Expected: FAIL — `validateCodeFormat` is not exported

- [ ] **Step 3: Implement `validateCodeFormat`**

Add to `server/src/lib/binValidation.ts`:

```ts
const CODE_REGEX = /^[A-Z0-9]{4,8}$/;

export function validateCodeFormat(code: string): void {
  if (!CODE_REGEX.test(code)) {
    throw new ValidationError('Code must be 4-8 alphanumeric characters');
  }
}
```

Also add the `ValidationError` import at the top of the file if not already present:

```ts
import { ValidationError } from './httpErrors.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/changeCode.test.ts`
Expected: PASS — all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/binValidation.ts server/src/__tests__/changeCode.test.ts
git commit -m "feat: add validateCodeFormat helper for bin code reassignment"
```

---

### Task 2: Server — Change code route with transaction

**Files:**
- Modify: `server/src/routes/bins.ts`
- Modify: `server/src/__tests__/changeCode.test.ts`

- [ ] **Step 1: Write failing tests for the route**

Add to `server/src/__tests__/changeCode.test.ts`:

```ts
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

// Keep existing validateCodeFormat tests above, add this describe block:

describe('POST /api/bins/:id/change-code', () => {
  let app: Express;
  beforeEach(() => { app = createApp(); });

  it('changes bin code to an unclaimed code', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id, { name: 'My Bin' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ZZZZZZ');
    expect(res.body.name).toBe('My Bin');

    // Old code should be gone
    const old = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(old.status).toBe(404);
  });

  it('changes bin code to a claimed code and deletes the old bin', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const binA = await createTestBin(app, token, loc.id, { name: 'Bin A', items: ['item1'] });
    const binB = await createTestBin(app, token, loc.id, { name: 'Bin B', items: ['item2'] });

    // Bin A adopts Bin B's code
    const res = await request(app)
      .post(`/api/bins/${binA.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: binB.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(binB.id);
    expect(res.body.name).toBe('Bin A');

    // Bin B should be deleted
    const lookup = await request(app)
      .get(`/api/bins/${binB.id}`)
      .set('Authorization', `Bearer ${token}`);
    // The bin at binB.id is now Bin A (renamed), so it should return Bin A's data
    expect(lookup.body.name).toBe('Bin A');
  });

  it('preserves items after code change', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id, { name: 'Items Bin', items: ['wrench', 'hammer'] });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TSTXYZ' });

    expect(res.status).toBe(200);
    const itemNames = res.body.items.map((i: { name: string }) => i.name);
    expect(itemNames).toContain('wrench');
    expect(itemNames).toContain('hammer');
  });

  it('rejects invalid code format', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ab' });

    expect(res.status).toBe(422);
  });

  it('rejects same code as current', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: bin.id });

    expect(res.status).toBe(422);
  });

  it('rejects non-admin users', async () => {
    const { token: adminToken } = await createTestUser(app);
    const loc = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, loc.id);

    // Create a member user
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post(`/api/locations/${loc.id}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: loc.invite_code });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(403);
  });

  it('rejects cross-location change when user is not admin in other location', async () => {
    const { token: adminToken } = await createTestUser(app);
    const loc1 = await createTestLocation(app, adminToken);
    const bin1 = await createTestBin(app, adminToken, loc1.id, { name: 'Bin in Loc1' });

    // Create a second user who is admin of a different location
    const { token: otherToken } = await createTestUser(app);
    const loc2 = await createTestLocation(app, otherToken);
    const bin2 = await createTestBin(app, otherToken, loc2.id, { name: 'Bin in Loc2' });

    // admin of loc1 tries to adopt a code from loc2 (where they are NOT a member)
    const res = await request(app)
      .post(`/api/bins/${bin1.id}/change-code`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: bin2.id });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins/NOPE99/change-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/changeCode.test.ts`
Expected: FAIL — route does not exist (404 for all route tests)

- [ ] **Step 3: Implement the route**

Add to `server/src/routes/bins.ts`, before the `export default router` line. Add the `sensitiveAuthLimiter` import at the top:

```ts
// Add to imports at top of file:
import { sensitiveAuthLimiter } from '../lib/rateLimiters.js';
import { validateCodeFormat } from '../lib/binValidation.js';

// Add route before the export:

// POST /api/bins/:id/change-code — change a bin's shortcode (admin only)
router.post('/:id/change-code', sensitiveAuthLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    throw new ValidationError('Code is required');
  }

  const newCode = code.toUpperCase();
  validateCodeFormat(newCode);

  if (newCode === id.toUpperCase()) {
    throw new ValidationError('New code is the same as current code');
  }

  // Verify access to target bin
  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await requireAdmin(access.locationId, req.user!.id, 'change bin code');

  // Check if newCode belongs to an existing bin (including trashed)
  const existingResult = await query<{ id: string; name: string; location_id: string }>(
    'SELECT id, name, location_id FROM bins WHERE UPPER(id) = $1',
    [newCode]
  );
  const existingBin = existingResult.rows[0] ?? null;

  // Cross-location permission check
  if (existingBin && existingBin.location_id !== access.locationId) {
    await requireAdmin(existingBin.location_id, req.user!.id, 'change bin code');
  }

  // Fetch photo paths before transaction (CASCADE will delete these rows)
  let existingPhotos: { storage_path: string; thumb_path: string | null }[] = [];
  if (existingBin) {
    const photosResult = await query<{ storage_path: string; thumb_path: string | null }>(
      'SELECT storage_path, thumb_path FROM photos WHERE bin_id = $1',
      [existingBin.id]
    );
    existingPhotos = photosResult.rows;
  }

  // Run the transaction (better-sqlite3 is synchronous)
  const db = getDb();
  db.transaction(() => {
    // defer_foreign_keys is required because steps below update child rows
    // to reference newCode before the parent row with that ID exists.
    db.pragma('defer_foreign_keys = ON');

    // 1. Hard-delete existing bin at newCode (CASCADE removes children)
    db.prepare('DELETE FROM bins WHERE id = ?').run(newCode);

    // 2. Update all FK references
    db.prepare('UPDATE bin_items SET bin_id = ? WHERE bin_id = ?').run(newCode, id);
    db.prepare('UPDATE photos SET bin_id = ? WHERE bin_id = ?').run(newCode, id);
    db.prepare('UPDATE bin_custom_field_values SET bin_id = ? WHERE bin_id = ?').run(newCode, id);
    db.prepare('UPDATE pinned_bins SET bin_id = ? WHERE bin_id = ?').run(newCode, id);
    db.prepare('UPDATE scan_history SET bin_id = ? WHERE bin_id = ?').run(newCode, id);

    // 3. Update photo storage paths
    db.prepare(`UPDATE photos SET
      storage_path = replace(storage_path, ? || '/', ? || '/'),
      thumb_path = CASE WHEN thumb_path IS NOT NULL
        THEN replace(thumb_path, ? || '/', ? || '/')
        ELSE NULL END
      WHERE bin_id = ?`).run(id, newCode, id, newCode, newCode);

    // 4. Update activity log references (not a FK)
    db.prepare("UPDATE activity_log SET entity_id = ? WHERE entity_id = ? AND entity_type = 'bin'")
      .run(newCode, id);

    // 5. Change the bin's primary key
    db.prepare("UPDATE bins SET id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newCode, id);
  })();

  // Post-transaction: clean up deleted bin's photos from disk
  if (existingPhotos.length > 0) {
    cleanupBinPhotos(newCode, existingPhotos);
  }

  // Rename target bin's photo directory
  const { PHOTO_STORAGE_PATH } = await import('../lib/uploadConfig.js');
  const oldDir = path.join(PHOTO_STORAGE_PATH, id);
  const newDir = path.join(PHOTO_STORAGE_PATH, newCode);
  try {
    if (fs.existsSync(oldDir)) {
      fs.renameSync(oldDir, newDir);
    }
  } catch (err) {
    console.error(`Failed to rename photo directory ${oldDir} → ${newDir}:`, err);
  }

  // Activity logging (fire-and-forget, post-transaction)
  if (existingBin) {
    logRouteActivity(req, {
      entityType: 'bin',
      locationId: existingBin.location_id,
      action: 'permanent_delete',
      entityId: newCode,
      entityName: existingBin.name,
    });
  }

  logRouteActivity(req, {
    entityType: 'bin',
    locationId: access.locationId,
    action: 'code_changed',
    entityId: newCode,
    entityName: updatedBin.name,
    changes: { code: { old: id, new: newCode } },
  });

  // Return updated bin
  const updatedBin = await fetchBinById(newCode, { userId: req.user!.id });
  if (!updatedBin) {
    throw new NotFoundError('Bin not found after code change');
  }

  res.json(updatedBin);
}));
```

Note: `PHOTO_STORAGE_PATH` is already exported from `uploadConfig.ts`. Since `fs` and `path` are already imported at the top of `bins.ts`, no new imports needed for those. The `validateCodeFormat` and `sensitiveAuthLimiter` imports are new.

**Important:** This route must be placed BEFORE the `/:id` GET route to avoid `change-code` being interpreted as a bin ID parameter. Place it after the `POST /` (create) route and before `GET /:id`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/__tests__/changeCode.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Run type check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/bins.ts server/src/__tests__/changeCode.test.ts
git commit -m "feat: add POST /bins/:id/change-code route for shortcode reassignment"
```

---

### Task 3: Client — Mutation function in useBins.ts

**Files:**
- Modify: `src/features/bins/useBins.ts`

- [ ] **Step 1: Add `changeCode` and `lookupBinByCodeSafe` functions**

Add to `src/features/bins/useBins.ts`, near the other mutation functions (`moveBin`, `deleteBin`, etc.):

```ts
/** Look up a bin by code. Returns the bin if found, null if not found / deleted / forbidden. */
export async function lookupBinByCodeSafe(code: string): Promise<{ bin: Bin | null; status: 'found' | 'not_found' | 'deleted' | 'forbidden' }> {
  try {
    const bin = await apiFetch<Bin>(`/api/bins/${encodeURIComponent(code.toUpperCase())}`);
    return { bin, status: 'found' };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return { bin: null, status: 'not_found' };
      if (err.status === 410) return { bin: null, status: 'deleted' };
      if (err.status === 403) return { bin: null, status: 'forbidden' };
    }
    throw err;
  }
}

export async function changeCode(binId: string, newCode: string): Promise<Bin> {
  const result = await apiFetch<Bin>(`/api/bins/${encodeURIComponent(binId)}/change-code`, {
    method: 'POST',
    body: { code: newCode.toUpperCase() },
  });
  notifyBinsChanged();
  notify(Events.PINS);
  notify(Events.SCAN_HISTORY);
  return result;
}
```

Update the import at the top of the file from `import { apiFetch } from '@/lib/api';` to `import { apiFetch, ApiError } from '@/lib/api';`. Also ensure `Events` and `notify` are imported from `@/lib/eventBus`.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/bins/useBins.ts
git commit -m "feat: add changeCode and lookupBinByCodeSafe client mutations"
```

---

### Task 4: Client — ChangeCodeDialog component

**Files:**
- Create: `src/features/bins/ChangeCodeDialog.tsx`
- Test: `src/features/bins/__tests__/ChangeCodeDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/features/bins/__tests__/ChangeCodeDialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChangeCodeDialog } from '../ChangeCodeDialog';

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
  useAuth: () => ({ activeLocationId: 'loc1', token: 'test-token', user: { id: 'u1' } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ChangeCodeDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders adopt mode title', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Change Code')).toBeTruthy();
  });

  it('renders reassign mode title', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="reassign"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Reassign Code')).toBeTruthy();
  });

  it('auto-uppercases manual input', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'abcxyz' } });
    expect((input as HTMLInputElement).value).toBe('ABCXYZ');
  });

  it('disables lookup button for invalid codes', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'AB' } });
    const btn = screen.getByRole('button', { name: /look up/i });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/bins/__tests__/ChangeCodeDialog.test.tsx`
Expected: FAIL — `ChangeCodeDialog` does not exist

- [ ] **Step 3: Implement `ChangeCodeDialog`**

Create `src/features/bins/ChangeCodeDialog.tsx`:

```tsx
import { Loader2, QrCode, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { BIN_URL_REGEX } from '@/lib/qr';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { changeCode, lookupBinByCodeSafe } from './useBins';

interface ChangeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'adopt' | 'reassign';
  currentBin: { id: string; name: string };
}

type Step = 'input' | 'confirm' | 'submitting';
type InputMode = 'manual' | 'scan';

interface LookupResult {
  code: string;
  claimed: boolean;
  binName?: string;
  forbidden?: boolean;
}

const CODE_REGEX = /^[A-Z0-9]{4,8}$/;

export function ChangeCodeDialog({ open, onOpenChange, mode, currentBin }: ChangeCodeDialogProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [code, setCode] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('input');
      setInputMode('manual');
      setCode('');
      setLookupResult(null);
      setLookingUp(false);
      setError('');
    }
  }, [open]);

  const isValidCode = CODE_REGEX.test(code) && code !== currentBin.id;

  async function handleLookup() {
    if (!isValidCode) return;
    setLookingUp(true);
    setError('');

    try {
      const result = await lookupBinByCodeSafe(code);

      if (result.status === 'forbidden') {
        setError('You do not have admin access to the location that owns this code.');
        setLookingUp(false);
        return;
      }

      setLookupResult({
        code,
        claimed: result.status === 'found',
        binName: result.bin?.name,
      });
      setStep('confirm');
    } catch {
      setError('Failed to look up code. Please try again.');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConfirm() {
    if (!lookupResult) return;
    setStep('submitting');

    try {
      // In adopt mode: current bin adopts the entered code
      // In reassign mode: the entered code's bin adopts current bin's code
      const targetBinId = mode === 'adopt' ? currentBin.id : lookupResult.code;
      const newCode = mode === 'adopt' ? lookupResult.code : currentBin.id;

      const result = await changeCode(targetBinId, newCode);

      onOpenChange(false);
      showToast({ message: `Code changed to ${result.id}` });

      // Navigate to the bin with its new code
      navigate(`/bin/${result.id}`, { replace: true });
    } catch {
      setError('Failed to change code. Please try again.');
      setStep('confirm');
    }
  }

  // Scanner callback
  const handleScan = useCallback((decodedText: string) => {
    const match = decodedText.match(BIN_URL_REGEX);
    if (match) {
      const scannedCode = match[1].toUpperCase();
      setCode(scannedCode);
      setInputMode('manual'); // Switch to manual to show the code
    }
  }, []);

  const title = mode === 'adopt' ? 'Change Code' : 'Reassign Code';
  const description = mode === 'adopt'
    ? 'Scan or enter the code from the label you want this bin to use.'
    : `Enter the code of the bin that should receive code ${currentBin.id}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            {/* Input mode toggle */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-flat)]">
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  inputMode === 'manual'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setInputMode('manual')}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Enter Code
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  inputMode === 'scan'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setInputMode('scan')}
              >
                <QrCode className="h-3.5 w-3.5" />
                Scan QR
              </button>
            </div>

            {inputMode === 'manual' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                    setError('');
                  }}
                  placeholder="Enter code..."
                  maxLength={8}
                  className="w-full rounded-lg border border-[var(--border-flat)] bg-[var(--bg-card)] px-3 py-2 text-sm font-mono tracking-wider text-center uppercase placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--border-focus)]"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && isValidCode && !lookingUp) handleLookup(); }}
                />
                {code && code === currentBin.id && (
                  <p className="text-[13px] text-[var(--destructive)]">This is already this bin's code.</p>
                )}
              </div>
            ) : (
              <ScannerPanel onScan={handleScan} />
            )}

            {error && (
              <p className="text-[13px] text-[var(--destructive)]">{error}</p>
            )}
          </div>
        )}

        {step === 'confirm' && lookupResult && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              {mode === 'adopt' ? (
                lookupResult.claimed ? (
                  <>Code <span className="font-mono font-semibold">{lookupResult.code}</span> belongs to &apos;{lookupResult.binName}&apos;. Adopting it will <strong>permanently delete</strong> that bin and change this bin&apos;s code from <span className="font-mono">{currentBin.id}</span> to <span className="font-mono">{lookupResult.code}</span>.</>
                ) : (
                  <>Change this bin&apos;s code from <span className="font-mono">{currentBin.id}</span> to <span className="font-mono font-semibold">{lookupResult.code}</span>?</>
                )
              ) : (
                <>Code <span className="font-mono font-semibold">{currentBin.id}</span> will move to &apos;{lookupResult.binName}&apos;. This bin (&apos;{currentBin.name}&apos;) will be <strong>permanently deleted</strong>.</>
              )}
            </p>
            {error && (
              <p className="text-[13px] text-[var(--destructive)]">{error}</p>
            )}
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleLookup}
                disabled={!isValidCode || lookingUp}
                aria-label="Look up"
              >
                {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look Up'}
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="ghost" onClick={() => { setStep('input'); setError(''); }}>Back</Button>
              <Button
                onClick={handleConfirm}
                variant={mode === 'reassign' || lookupResult?.claimed ? 'destructive' : 'default'}
              >
                {mode === 'adopt' ? 'Change Code' : 'Reassign'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lazy-loaded QR scanner panel. Only mounts the camera when this tab is active. */
function ScannerPanel({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (stopped || !scannerRef.current) return;

      const scanner = new Html5Qrcode(scannerRef.current.id);
      html5QrRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {},
        );
      } catch {
        setScanError('Camera access denied or not available.');
      }
    }

    startScanner();

    return () => {
      stopped = true;
      const scanner = html5QrRef.current as { stop?: () => Promise<void> } | null;
      scanner?.stop?.().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="space-y-2">
      <div
        id="change-code-scanner"
        ref={scannerRef}
        className="w-full aspect-square max-h-[300px] rounded-lg overflow-hidden bg-black"
      />
      {scanError && (
        <p className="text-[13px] text-[var(--destructive)]">{scanError}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/bins/__tests__/ChangeCodeDialog.test.tsx`
Expected: PASS — all 4 tests pass

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/features/bins/ChangeCodeDialog.tsx src/features/bins/__tests__/ChangeCodeDialog.test.tsx
git commit -m "feat: add ChangeCodeDialog component with scan and manual entry"
```

---

### Task 5: Client — Wire dialog into BinDetailPage

**Files:**
- Modify: `src/features/bins/useBinDetailActions.ts`
- Modify: `src/features/bins/BinDetailToolbar.tsx`
- Modify: `src/features/bins/BinDetailPage.tsx`

- [ ] **Step 1: Add dialog state to `useBinDetailActions.ts`**

Add state variables and return them:

```ts
// Add after the existing dialog state (line 35):
const [changeCodeMode, setChangeCodeMode] = useState<'adopt' | 'reassign' | null>(null);
```

Add to the return object:

```ts
// Add to return block (after aiSetupOpen, setAiSetupOpen):
changeCodeMode, setChangeCodeMode,
// Also add isAdmin (already destructured from usePermissions but not returned):
isAdmin,
```

- [ ] **Step 2: Add menu items and callbacks to `BinDetailToolbar.tsx`**

Add to the `BinDetailToolbarProps` interface:

```ts
isAdmin: boolean;
onChangeCode: () => void;
onReassignCode: () => void;
```

Add to the destructured props.

Add two new overflow menu items. Place them after the "Move" button and before the delete separator:

```tsx
{isAdmin && (
  <button
    type="button"
    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
    onClick={() => handleItem(onChangeCode)}
  >
    <QrCode className="h-4 w-4 text-[var(--text-tertiary)]" />
    Change Code
  </button>
)}
{isAdmin && (
  <button
    type="button"
    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
    onClick={() => handleItem(onReassignCode)}
  >
    <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
    Reassign Code
  </button>
)}
```

Add `QrCode` to the lucide-react import at the top of the file. Note: `ArrowRightLeft` is already imported.

- [ ] **Step 3: Wire up in `BinDetailPage.tsx`**

Add the `ChangeCodeDialog` import:

```ts
import { ChangeCodeDialog } from './ChangeCodeDialog';
```

Pass the new props to `BinDetailToolbar`:

```tsx
isAdmin={actions.isAdmin}
onChangeCode={() => actions.setChangeCodeMode('adopt')}
onReassignCode={() => actions.setChangeCodeMode('reassign')}
```

Add the dialog below the existing dialogs (after `AiSetupDialog`):

```tsx
{actions.changeCodeMode && (
  <ChangeCodeDialog
    open={!!actions.changeCodeMode}
    onOpenChange={(open) => { if (!open) actions.setChangeCodeMode(null); }}
    mode={actions.changeCodeMode}
    currentBin={{ id: bin.id, name: bin.name }}
  />
)}
```

- [ ] **Step 4: Run type check and lint**

Run: `npx tsc --noEmit && npx biome check .`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/bins/useBinDetailActions.ts src/features/bins/BinDetailToolbar.tsx src/features/bins/BinDetailPage.tsx
git commit -m "feat: wire ChangeCodeDialog into bin detail overflow menu"
```

---

### Task 6: Server — Update OpenAPI spec

**Files:**
- Modify: `server/openapi.yaml`

- [ ] **Step 1: Add the endpoint documentation**

Add under the `paths` section in `server/openapi.yaml`:

```yaml
  /api/bins/{id}/change-code:
    post:
      summary: Change bin shortcode
      description: |
        Change a bin's shortcode (primary key). If the new code belongs to another bin,
        that bin is permanently deleted. Requires admin role.
      tags: [Bins]
      security:
        - bearerAuth: []
        - cookieAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: ID of the bin whose code will change (the survivor)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code]
              properties:
                code:
                  type: string
                  pattern: '^[A-Z0-9]{4,8}$'
                  description: New code to adopt
      responses:
        '200':
          description: Bin with updated code
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Bin'
        '403':
          description: Not admin in one or both locations
        '404':
          description: Target bin not found
        '409':
          description: Conflict (concurrent modification)
        '422':
          description: Invalid code format or same as current code
```

- [ ] **Step 2: Commit**

```bash
git add server/openapi.yaml
git commit -m "docs: add change-code endpoint to OpenAPI spec"
```

---

### Task 7: Verification

- [ ] **Step 1: Run full server test suite**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run full client test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run type checks and lint**

Run: `npx tsc --noEmit && cd server && npx tsc --noEmit && cd .. && npx biome check .`
Expected: No errors

- [ ] **Step 4: Build check**

Run: `npx vite build`
Expected: Build succeeds
