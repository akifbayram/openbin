import { describe, expect, it } from 'vitest';
import { query } from '../../db.js';
import { cancelReverts, logActivity, mergeBinChanges } from '../activityLog.js';

describe('mergeBinChanges', () => {
  it('concatenates items_added arrays', () => {
    const existing = { items_added: { old: null, new: ['a', 'b'] } };
    const incoming = { items_added: { old: null, new: ['c'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_added: { old: null, new: ['a', 'b', 'c'] },
    });
  });

  it('concatenates items_removed arrays', () => {
    const existing = { items_removed: { old: ['a'], new: null } };
    const incoming = { items_removed: { old: ['b', 'c'], new: null } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_removed: { old: ['a', 'b', 'c'], new: null },
    });
  });

  it('merges scalar field chain preserving earliest old', () => {
    const existing = { notes: { old: 'A', new: 'B' } };
    const incoming = { notes: { old: 'B', new: 'C' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      notes: { old: 'A', new: 'C' },
    });
  });

  it('merges tag arrays preserving earliest old', () => {
    const existing = { tags: { old: ['X'], new: ['X', 'Y'] } };
    const incoming = { tags: { old: ['X', 'Y'], new: ['Y'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      tags: { old: ['X'], new: ['Y'] },
    });
  });

  it('combines unrelated fields across merges', () => {
    const existing = { notes: { old: 'A', new: 'B' } };
    const incoming = { tags: { old: [], new: ['t'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      notes: { old: 'A', new: 'B' },
      tags: { old: [], new: ['t'] },
    });
  });

  it('first occurrence of a scalar field uses incoming.old', () => {
    const existing = {};
    const incoming = { color: { old: 'red', new: 'blue' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      color: { old: 'red', new: 'blue' },
    });
  });

  it('preserves undefined old when merging chained updates (regression guard for hasOwnProperty check)', () => {
    const existing = { color: { old: undefined, new: 'blue' } };
    const incoming = { color: { old: 'blue', new: 'green' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      color: { old: undefined, new: 'green' },
    });
  });

  it('passes through items_renamed unchanged when there is no prior entry', () => {
    const existing = {};
    const incoming = { items_renamed: { old: 'A', new: 'B' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_renamed: { old: 'A', new: 'B' },
    });
  });

  it('collapses a rename chain A->B then B->C to A->C', () => {
    const existing = { items_renamed: { old: 'A', new: 'B' } };
    const incoming = { items_renamed: { old: 'B', new: 'C' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_renamed: { old: 'A', new: 'C' },
    });
  });

  it('upgrades items_renamed to an array when not a chain', () => {
    const existing = { items_renamed: { old: 'X', new: 'Y' } };
    const incoming = { items_renamed: { old: 'P', new: 'Q' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_renamed: {
        old: null,
        new: [
          { old: 'X', new: 'Y' },
          { old: 'P', new: 'Q' },
        ],
      },
    });
  });

  it('appends to an existing items_renamed array on a new non-chain rename', () => {
    const existing = {
      items_renamed: {
        old: null,
        new: [
          { old: 'X', new: 'Y' },
          { old: 'P', new: 'Q' },
        ],
      },
    };
    const incoming = { items_renamed: { old: 'M', new: 'N' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_renamed: {
        old: null,
        new: [
          { old: 'X', new: 'Y' },
          { old: 'P', new: 'Q' },
          { old: 'M', new: 'N' },
        ],
      },
    });
  });

  it('chains a new rename against the last entry in an items_renamed array', () => {
    const existing = {
      items_renamed: {
        old: null,
        new: [
          { old: 'X', new: 'Y' },
          { old: 'P', new: 'Q' },
        ],
      },
    };
    const incoming = { items_renamed: { old: 'Q', new: 'R' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_renamed: {
        old: null,
        new: [
          { old: 'X', new: 'Y' },
          { old: 'P', new: 'R' },
        ],
      },
    });
  });

  it('merges items_quantity preserving earliest old snapshot', () => {
    const existing = { items_quantity: { old: { name: 'bolt', qty: 5 }, new: { name: 'bolt', qty: 10 } } };
    const incoming = { items_quantity: { old: { name: 'bolt', qty: 10 }, new: { name: 'bolt', qty: 15 } } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_quantity: { old: { name: 'bolt', qty: 5 }, new: { name: 'bolt', qty: 15 } },
    });
  });
});

describe('cancelReverts', () => {
  it('drops scalar fields whose old equals new', () => {
    expect(cancelReverts({ notes: { old: 'A', new: 'A' } })).toEqual({});
  });

  it('drops tag arrays whose old deep-equals new', () => {
    expect(cancelReverts({ tags: { old: ['x', 'y'], new: ['x', 'y'] } })).toEqual({});
  });

  it('keeps scalar fields whose old differs from new', () => {
    expect(cancelReverts({ notes: { old: 'A', new: 'B' } })).toEqual({
      notes: { old: 'A', new: 'B' },
    });
  });

  it('removes items that appear in both items_added and items_removed', () => {
    const changes = {
      items_added: { old: null, new: ['foo', 'bar'] },
      items_removed: { old: ['foo', 'baz'], new: null },
    };
    expect(cancelReverts(changes)).toEqual({
      items_added: { old: null, new: ['bar'] },
      items_removed: { old: ['baz'], new: null },
    });
  });

  it('drops items_added / items_removed keys when their arrays become empty', () => {
    const changes = {
      items_added: { old: null, new: ['foo'] },
      items_removed: { old: ['foo'], new: null },
    };
    expect(cancelReverts(changes)).toEqual({});
  });

  it('drops items_renamed legacy object when old equals new', () => {
    expect(cancelReverts({ items_renamed: { old: 'A', new: 'A' } })).toEqual({});
  });

  it('drops items_renamed array entries where old equals new; drops key when array empties', () => {
    const changes = {
      items_renamed: {
        old: null,
        new: [
          { old: 'A', new: 'A' },
          { old: 'X', new: 'Y' },
        ],
      },
    };
    expect(cancelReverts(changes)).toEqual({
      items_renamed: { old: null, new: [{ old: 'X', new: 'Y' }] },
    });
  });

  it('drops items_quantity when qty did not change', () => {
    const changes = {
      items_quantity: { old: { name: 'bolt', qty: 5 }, new: { name: 'bolt', qty: 5 } },
    };
    expect(cancelReverts(changes)).toEqual({});
  });

  it('keeps items_quantity when qty changed', () => {
    const changes = {
      items_quantity: { old: { name: 'bolt', qty: 5 }, new: { name: 'bolt', qty: 10 } },
    };
    expect(cancelReverts(changes)).toEqual(changes);
  });

  it('leaves unrelated non-reverted fields intact', () => {
    const changes = {
      notes: { old: 'A', new: 'B' },
      tags: { old: [], new: [] },
    };
    expect(cancelReverts(changes)).toEqual({ notes: { old: 'A', new: 'B' } });
  });
});

async function seedUserAndLocation() {
  await query(
    "INSERT INTO users (id, display_name, email) VALUES ('u1', 'Test', 'test@test.local')",
  );
  await query(
    "INSERT INTO locations (id, name, created_by, invite_code) VALUES ('loc1', 'Loc', 'u1', 'code-1')",
  );
}

describe('logActivity + tryMerge (integration)', () => {
  it('merges two bin updates (different fields) into one row within the window', async () => {
    await seedUserAndLocation();

    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { notes: { old: 'A', new: 'B' } },
    });
    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { tags: { old: ['X'], new: ['X', 'Y'] } },
    });

    const rows = await query<{ changes: Record<string, { old: unknown; new: unknown }> }>(
      "SELECT changes FROM activity_log WHERE entity_id = 'bin1'",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].changes).toEqual({
      notes: { old: 'A', new: 'B' },
      tags: { old: ['X'], new: ['X', 'Y'] },
    });
  });

  it('deletes the row when all fields revert to their original value', async () => {
    await seedUserAndLocation();

    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { notes: { old: 'A', new: 'B' } },
    });
    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { notes: { old: 'B', new: 'A' } },
    });

    const rows = await query("SELECT id FROM activity_log WHERE entity_id = 'bin1'");
    expect(rows.rows).toHaveLength(0);
  });

  it('does not merge across different users', async () => {
    await seedUserAndLocation();
    await query("INSERT INTO users (id, display_name, email) VALUES ('u2', 'Other', 'other@test.local')");

    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { notes: { old: 'A', new: 'B' } },
    });
    await logActivity({
      locationId: 'loc1', userId: 'u2', userName: 'other@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { tags: { old: [], new: ['Y'] } },
    });

    const rows = await query("SELECT id FROM activity_log WHERE entity_id = 'bin1'");
    expect(rows.rows).toHaveLength(2);
  });

  it('does not merge a create with a subsequent update', async () => {
    await seedUserAndLocation();

    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'create', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
    });
    await logActivity({
      locationId: 'loc1', userId: 'u1', userName: 'test@test.local',
      action: 'update', entityType: 'bin', entityId: 'bin1', entityName: 'Bin',
      changes: { notes: { old: '', new: 'hello' } },
    });

    const rows = await query<{ action: string }>(
      "SELECT action FROM activity_log WHERE entity_id = 'bin1' ORDER BY action",
    );
    expect(rows.rows.map((r) => r.action).sort()).toEqual(['create', 'update']);
  });
});
