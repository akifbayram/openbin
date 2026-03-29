import { beforeEach, describe, expect, it } from 'vitest';
import { generateUuid, getDb, query, querySync } from '../../db.js';
import type { ExportBin } from '../exportHelpers.js';
import {
  buildDryRunPreview,
  executeFullImportTransaction,
  lookupAreaSync,
} from '../importTransaction.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(id: string, username: string) {
  await query(
    'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)',
    [id, username, 'hash', username],
  );
}

async function createLocation(id: string, name: string, createdBy: string) {
  const inviteCode = generateUuid().slice(0, 8);
  await query(
    'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
    [id, name, createdBy, inviteCode],
  );
  await query(
    "INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, 'admin')",
    [generateUuid(), id, createdBy],
  );
}

function makeBin(overrides: Partial<ExportBin> & { id: string; name: string }): ExportBin {
  return {
    location: '',
    items: [],
    notes: '',
    tags: [],
    icon: '',
    color: '',
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const USER_ID = 'user-1';
const LOCATION_ID = 'loc-1';

beforeEach(async () => {
  await createUser(USER_ID, 'testuser');
  await createLocation(LOCATION_ID, 'Test Location', USER_ID);
});

// ---------------------------------------------------------------------------
// buildDryRunPreview
// ---------------------------------------------------------------------------

describe('buildDryRunPreview', () => {
  it('replace mode puts all bins in toCreate', () => {
    const bins = [
      { name: 'Bin A', id: 'aaa', items: [{ name: 'wrench' }], tags: ['tool'] },
      { name: 'Bin B', id: 'bbb', items: [], tags: [] },
    ];
    const result = buildDryRunPreview(bins, 'replace');
    expect(result.preview).toBe(true);
    expect(result.toCreate).toHaveLength(2);
    expect(result.toSkip).toHaveLength(0);
    expect(result.totalBins).toBe(2);
    expect(result.totalItems).toBe(1);
  });

  it('merge mode skips existing bin IDs', () => {
    // Insert a bin into DB so it exists
    const db = getDb();
    db.prepare(
      'INSERT INTO bins (id, location_id, name, area_id, notes, icon, color, created_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    ).run('existid', LOCATION_ID, 'Existing', '', '', '', USER_ID);

    const bins = [
      { name: 'Existing', id: 'existid', items: [], tags: [] },
      { name: 'New Bin', id: 'newbin', items: [{ name: 'item1' }, { name: 'item2' }], tags: ['a'] },
    ];
    const result = buildDryRunPreview(bins, 'merge');
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].name).toBe('Existing');
    expect(result.toSkip[0].reason).toBe('already exists');
    expect(result.toCreate).toHaveLength(1);
    expect(result.toCreate[0].name).toBe('New Bin');
  });

  it('returns empty arrays for empty bins input', () => {
    const result = buildDryRunPreview([], 'merge');
    expect(result.toCreate).toEqual([]);
    expect(result.toSkip).toEqual([]);
    expect(result.totalBins).toBe(0);
    expect(result.totalItems).toBe(0);
  });

  it('counts totalItems across all bins', () => {
    const bins = [
      { name: 'A', id: 'a1', items: [{ name: 'x' }, { name: 'y' }], tags: [] },
      { name: 'B', id: 'b1', items: [{ name: 'z' }], tags: [] },
      { name: 'C', id: 'c1', items: [], tags: [] },
    ];
    const result = buildDryRunPreview(bins, 'replace');
    expect(result.totalItems).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// lookupAreaSync
// ---------------------------------------------------------------------------

describe('lookupAreaSync', () => {
  it('returns null for non-existent area', () => {
    expect(lookupAreaSync(LOCATION_ID, 'NoSuchArea')).toBeNull();
  });

  it('returns area ID for existing top-level area', () => {
    const areaId = generateUuid();
    const db = getDb();
    db.prepare(
      'INSERT INTO areas (id, location_id, name, parent_id, created_by) VALUES (?, ?, ?, NULL, ?)',
    ).run(areaId, LOCATION_ID, 'Garage', USER_ID);

    expect(lookupAreaSync(LOCATION_ID, 'Garage')).toBe(areaId);
  });

  it('handles nested path "Parent / Child"', () => {
    const db = getDb();
    const parentId = generateUuid();
    const childId = generateUuid();
    db.prepare(
      'INSERT INTO areas (id, location_id, name, parent_id, created_by) VALUES (?, ?, ?, NULL, ?)',
    ).run(parentId, LOCATION_ID, 'Garage', USER_ID);
    db.prepare(
      'INSERT INTO areas (id, location_id, name, parent_id, created_by) VALUES (?, ?, ?, ?, ?)',
    ).run(childId, LOCATION_ID, 'Shelf A', parentId, USER_ID);

    expect(lookupAreaSync(LOCATION_ID, 'Garage / Shelf A')).toBe(childId);
  });

  it('returns null if any path segment is missing', () => {
    const db = getDb();
    const parentId = generateUuid();
    db.prepare(
      'INSERT INTO areas (id, location_id, name, parent_id, created_by) VALUES (?, ?, ?, NULL, ?)',
    ).run(parentId, LOCATION_ID, 'Garage', USER_ID);

    // "Garage" exists but "Shelf B" does not
    expect(lookupAreaSync(LOCATION_ID, 'Garage / Shelf B')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// executeFullImportTransaction
// ---------------------------------------------------------------------------

describe('executeFullImportTransaction', () => {
  it('merge mode imports new bins and skips existing', () => {
    const db = getDb();
    db.prepare(
      'INSERT INTO bins (id, location_id, name, area_id, notes, icon, color, created_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    ).run('exist1', LOCATION_ID, 'Existing Bin', '', '', '', USER_ID);

    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: true,
      importMode: 'merge',
      bins: [
        makeBin({ id: 'exist1', name: 'Existing Bin' }),
        makeBin({ id: 'new111', name: 'New Bin', items: ['screwdriver'] }),
      ],
    });

    expect(result.binsImported).toBe(1);
    expect(result.binsSkipped).toBe(1);
    // The new bin should exist in DB
    const rows = querySync('SELECT name FROM bins WHERE location_id = $1', [LOCATION_ID]);
    const names = rows.rows.map((r) => r.name);
    expect(names).toContain('Existing Bin');
    expect(names).toContain('New Bin');
  });

  it('replace mode clears existing bins and imports all', () => {
    const db = getDb();
    db.prepare(
      'INSERT INTO bins (id, location_id, name, area_id, notes, icon, color, created_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    ).run('old111', LOCATION_ID, 'Old Bin', '', '', '', USER_ID);

    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: true,
      importMode: 'replace',
      bins: [
        makeBin({ id: 'imp111', name: 'Imported Bin' }),
      ],
    });

    expect(result.binsImported).toBe(1);
    expect(result.binsSkipped).toBe(0);
    // Old bin should be gone
    const rows = querySync('SELECT name FROM bins WHERE location_id = $1 AND deleted_at IS NULL', [LOCATION_ID]);
    const names = rows.rows.map((r) => r.name);
    expect(names).not.toContain('Old Bin');
    expect(names).toContain('Imported Bin');
  });

  it('imports tag colors', () => {
    executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'merge',
      bins: [],
      tagColors: [
        { tag: 'urgent', color: '#ff0000' },
        { tag: 'low', color: '#00ff00' },
      ],
    });

    const rows = querySync('SELECT tag, color FROM tag_colors WHERE location_id = $1', [LOCATION_ID]);
    expect(rows.rows).toHaveLength(2);
    const tags = rows.rows.map((r) => r.tag);
    expect(tags).toContain('urgent');
    expect(tags).toContain('low');
  });

  it('imports areas hierarchy', () => {
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'merge',
      bins: [],
      areas: [
        { path: 'Garage' },
        { path: 'Garage / Shelf A' },
        { path: 'Kitchen' },
      ],
    });

    expect(result.areasImported).toBe(3);
    // Verify hierarchy
    const garage = querySync(
      'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id IS NULL',
      [LOCATION_ID, 'Garage'],
    );
    expect(garage.rows).toHaveLength(1);
    const shelfA = querySync(
      'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id = $3',
      [LOCATION_ID, 'Shelf A', (garage.rows[0] as { id: string }).id],
    );
    expect(shelfA.rows).toHaveLength(1);
  });

  it('imports custom field definitions and maps to bin values', () => {
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'merge',
      bins: [
        makeBin({
          id: 'cf1111',
          name: 'Bin With Fields',
          customFields: { Weight: '5kg', Color: 'Red' },
        }),
      ],
      customFieldDefinitions: [
        { name: 'Weight', position: 0 },
        { name: 'Color', position: 1 },
      ],
    });

    expect(result.binsImported).toBe(1);

    // Custom field definitions should exist
    const defs = querySync(
      'SELECT id, name FROM location_custom_fields WHERE location_id = $1 ORDER BY position',
      [LOCATION_ID],
    );
    expect(defs.rows).toHaveLength(2);
    const defNames = defs.rows.map((r) => r.name);
    expect(defNames).toContain('Weight');
    expect(defNames).toContain('Color');

    // Bin should have custom field values (mapped by field ID, not name)
    const binRow = querySync("SELECT id FROM bins WHERE location_id = $1 AND name = 'Bin With Fields'", [LOCATION_ID]);
    expect(binRow.rows).toHaveLength(1);
    const binId = (binRow.rows[0] as { id: string }).id;
    const vals = querySync(
      'SELECT field_id, value FROM bin_custom_field_values WHERE bin_id = $1',
      [binId],
    );
    expect(vals.rows).toHaveLength(2);
  });

  it('imports trashed bins with deleted_at set', () => {
    const deletedAt = '2025-01-15T00:00:00.000Z';
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'merge',
      bins: [makeBin({ id: 'act111', name: 'Active Bin' })],
      trashedBins: [
        makeBin({ id: 'trsh11', name: 'Trashed Bin', deletedAt }),
        makeBin({ id: 'trsh22', name: 'Trashed Bin 2', deletedAt: '2025-02-01T00:00:00.000Z' }),
      ],
    });

    expect(result.binsImported).toBe(1);
    expect(result.trashedBinsImported).toBe(2);

    // Trashed bins should have deleted_at set
    const trashed = querySync(
      'SELECT name, deleted_at FROM bins WHERE location_id = $1 AND deleted_at IS NOT NULL',
      [LOCATION_ID],
    );
    expect(trashed.rows).toHaveLength(2);
    const trashedNames = trashed.rows.map((r) => r.name);
    expect(trashedNames).toContain('Trashed Bin');
    expect(trashedNames).toContain('Trashed Bin 2');

    // Active bin should NOT have deleted_at
    const active = querySync(
      "SELECT deleted_at FROM bins WHERE location_id = $1 AND name = 'Active Bin'",
      [LOCATION_ID],
    );
    expect(active.rows).toHaveLength(1);
    expect((active.rows[0] as { deleted_at: string | null }).deleted_at).toBeNull();
  });

  it('imports pinned bins', () => {
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'merge',
      bins: [
        makeBin({ id: 'pin111', name: 'Pinned Bin' }),
        makeBin({ id: 'pin222', name: 'Also Pinned' }),
      ],
      pinnedBins: [
        { userId: USER_ID, binId: 'pin111', position: 0 },
        { userId: USER_ID, binId: 'pin222', position: 1 },
      ],
    });

    expect(result.binsImported).toBe(2);
    expect(result.pinsImported).toBe(2);

    // Verify pinned_bins table has entries with the new bin IDs
    const pins = querySync(
      'SELECT bin_id, position FROM pinned_bins WHERE user_id = $1 ORDER BY position',
      [USER_ID],
    );
    expect(pins.rows).toHaveLength(2);
    expect((pins.rows[0] as { position: number }).position).toBe(0);
    expect((pins.rows[1] as { position: number }).position).toBe(1);
  });

  it('imports location settings in replace mode as admin', () => {
    const settings = {
      activityRetentionDays: 60,
      trashRetentionDays: 14,
      appName: 'My Custom App',
      termBin: 'Container',
      termLocation: 'Warehouse',
      termArea: 'Zone',
      defaultJoinRole: 'viewer' as const,
    };

    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: true,
      importMode: 'replace',
      bins: [],
      locationSettings: settings,
    });

    expect(result.settingsApplied).toBe(true);

    // Verify settings were applied to the location
    const loc = querySync('SELECT activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role FROM locations WHERE id = $1', [LOCATION_ID]);
    expect(loc.rows).toHaveLength(1);
    const row = loc.rows[0] as Record<string, unknown>;
    expect(row.activity_retention_days).toBe(60);
    expect(row.trash_retention_days).toBe(14);
    expect(row.app_name).toBe('My Custom App');
    expect(row.term_bin).toBe('Container');
    expect(row.term_location).toBe('Warehouse');
    expect(row.term_area).toBe('Zone');
    expect(row.default_join_role).toBe('viewer');
  });

  it('does NOT apply location settings when not admin', () => {
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: false,
      importMode: 'replace',
      bins: [],
      locationSettings: {
        activityRetentionDays: 99,
        trashRetentionDays: 99,
        appName: 'Should Not Apply',
        termBin: 'X',
        termLocation: 'X',
        termArea: 'X',
        defaultJoinRole: 'viewer',
      },
    });

    expect(result.settingsApplied).toBe(false);
  });

  it('does NOT apply location settings in merge mode', () => {
    const result = executeFullImportTransaction({
      locationId: LOCATION_ID,
      userId: USER_ID,
      isAdmin: true,
      importMode: 'merge',
      bins: [],
      locationSettings: {
        activityRetentionDays: 99,
        trashRetentionDays: 99,
        appName: 'Should Not Apply',
        termBin: 'X',
        termLocation: 'X',
        termArea: 'X',
        defaultJoinRole: 'viewer',
      },
    });

    expect(result.settingsApplied).toBe(false);
  });

  it('transaction is atomic: partial failure rolls back', () => {
    const db = getDb();
    // Insert a bin so we can verify it survives a failed replace import
    db.prepare(
      'INSERT INTO bins (id, location_id, name, area_id, notes, icon, color, created_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    ).run('keep11', LOCATION_ID, 'Keep Me', '', '', '', USER_ID);

    // Create a bin with a name that will trigger an error inside the transaction
    // by making the DB throw (e.g., violate a NOT NULL constraint on a required field)
    const badBin = makeBin({ id: 'bad111', name: null as unknown as string });

    try {
      executeFullImportTransaction({
        locationId: LOCATION_ID,
        userId: USER_ID,
        isAdmin: true,
        importMode: 'replace',
        bins: [badBin],
      });
    } catch {
      // Expected to throw
    }

    // The original bin should still exist because replace cleanup was rolled back
    const rows = querySync("SELECT id FROM bins WHERE id = 'keep11'", []);
    expect(rows.rows).toHaveLength(1);
  });
});
