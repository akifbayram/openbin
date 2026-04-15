import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';
import type { ActivityLogEntry } from '@/types';
import {
  getActionBadgeLabel,
  getActionColor,
  getActionIcon,
  getActionLabel,
  getChangedFieldLabels,
  renderChangeDiff,
} from '../activityHelpers';

function entry(overrides: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: '1',
    location_id: 'loc-1',
    user_id: 'u1',
    user_name: 'test',
    display_name: 'Test',
    action: 'create',
    entity_type: 'bin',
    entity_id: 'b1',
    entity_name: 'Box',
    changes: null,
    auth_method: null,
    api_key_name: null,
    created_at: '2024-01-01',
    ...overrides,
  };
}

const t = DEFAULT_TERMINOLOGY;

describe('getActionColor', () => {
  it('returns green for create', () => {
    expect(getActionColor('create')).toBe('text-[var(--color-success)]');
  });

  it('returns destructive for delete', () => {
    expect(getActionColor('delete')).toBe('text-[var(--destructive)]');
  });

  it('returns destructive for permanent_delete', () => {
    expect(getActionColor('permanent_delete')).toBe('text-[var(--destructive)]');
  });

  it('returns accent for restore', () => {
    expect(getActionColor('restore')).toBe('text-[var(--accent)]');
  });

  it('returns amber for update', () => {
    expect(getActionColor('update')).toBe('text-[var(--color-warning)]');
  });

  it('returns blue for move_in', () => {
    expect(getActionColor('move_in')).toBe('text-[var(--color-info)]');
  });

  it('returns blue for move_out', () => {
    expect(getActionColor('move_out')).toBe('text-[var(--color-info)]');
  });

  it('returns tertiary for unknown action', () => {
    expect(getActionColor('unknown_action')).toBe('text-[var(--text-tertiary)]');
  });
});

describe('getActionIcon', () => {
  it('returns a valid element for create', () => {
    const result = getActionIcon(entry({ action: 'create' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for update', () => {
    const result = getActionIcon(entry({ action: 'update' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for delete', () => {
    const result = getActionIcon(entry({ action: 'delete' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for permanent_delete', () => {
    const result = getActionIcon(entry({ action: 'permanent_delete' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for restore', () => {
    const result = getActionIcon(entry({ action: 'restore' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for add_photo', () => {
    const result = getActionIcon(entry({ action: 'add_photo' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for delete_photo', () => {
    const result = getActionIcon(entry({ action: 'delete_photo' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for move_in', () => {
    const result = getActionIcon(entry({ action: 'move_in' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for join', () => {
    const result = getActionIcon(entry({ action: 'join' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for leave', () => {
    const result = getActionIcon(entry({ action: 'leave' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for remove_member', () => {
    const result = getActionIcon(entry({ action: 'remove_member' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for change_role', () => {
    const result = getActionIcon(entry({ action: 'change_role' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for area entity with unknown action', () => {
    const result = getActionIcon(entry({ action: 'some_unknown', entity_type: 'area' }));
    expect(isValidElement(result)).toBe(true);
  });

  it('returns a valid element for fallback (unknown action and entity)', () => {
    const result = getActionIcon(entry({ action: 'some_unknown', entity_type: 'some_type' }));
    expect(isValidElement(result)).toBe(true);
  });
});

describe('getActionLabel', () => {
  it('bin create', () => {
    expect(getActionLabel(entry({ action: 'create' }), t)).toBe('created bin "Box"');
  });

  it('bin update (generic)', () => {
    expect(getActionLabel(entry({ action: 'update' }), t)).toBe('updated bin "Box"');
  });

  it('bin update with items_added', () => {
    const e = entry({
      action: 'update',
      changes: { items_added: { old: null, new: ['Cable'] } },
    });
    expect(getActionLabel(e, t)).toBe('added Cable to bin "Box"');
  });

  it('bin update with items_removed', () => {
    const e = entry({
      action: 'update',
      changes: { items_removed: { old: ['Cable'], new: null } },
    });
    expect(getActionLabel(e, t)).toBe('removed Cable from bin "Box"');
  });

  it('bin update with items_renamed', () => {
    const e = entry({
      action: 'update',
      changes: { items_renamed: { old: 'Old', new: 'New' } },
    });
    expect(getActionLabel(e, t)).toBe('renamed Old to New in bin "Box"');
  });

  it('bin update with items reorder', () => {
    const e = entry({
      action: 'update',
      changes: { items: { old: ['A', 'B'], new: ['B', 'A'] } },
    });
    expect(getActionLabel(e, t)).toBe('reordered items in bin "Box"');
  });

  it('bin delete', () => {
    expect(getActionLabel(entry({ action: 'delete' }), t)).toBe('deleted bin "Box"');
  });

  it('bin restore', () => {
    expect(getActionLabel(entry({ action: 'restore' }), t)).toBe('restored bin "Box"');
  });

  it('bin permanent_delete', () => {
    expect(getActionLabel(entry({ action: 'permanent_delete' }), t)).toBe(
      'permanently deleted bin "Box"',
    );
  });

  it('bin move_in with location changes', () => {
    const e = entry({
      action: 'move_in',
      changes: { location: { old: 'Loc A', new: 'Loc B' } },
    });
    expect(getActionLabel(e, t)).toBe('moved bin "Box" from Loc A to Loc B');
  });

  it('bin add_photo', () => {
    expect(getActionLabel(entry({ action: 'add_photo' }), t)).toBe('added photo to bin "Box"');
  });

  it('bin delete_photo', () => {
    expect(getActionLabel(entry({ action: 'delete_photo' }), t)).toBe(
      'removed photo from bin "Box"',
    );
  });

  it('area create', () => {
    const e = entry({ action: 'create', entity_type: 'area', entity_name: 'Shelf' });
    expect(getActionLabel(e, t)).toBe('created area "Shelf"');
  });

  it('area update', () => {
    const e = entry({ action: 'update', entity_type: 'area', entity_name: 'Shelf' });
    expect(getActionLabel(e, t)).toBe('renamed area to "Shelf"');
  });

  it('area delete', () => {
    const e = entry({ action: 'delete', entity_type: 'area', entity_name: 'Shelf' });
    expect(getActionLabel(e, t)).toBe('deleted area "Shelf"');
  });

  it('member join', () => {
    const e = entry({ action: 'join', entity_type: 'member' });
    expect(getActionLabel(e, t)).toBe('joined the location');
  });

  it('member leave', () => {
    const e = entry({ action: 'leave', entity_type: 'member' });
    expect(getActionLabel(e, t)).toBe('left the location');
  });

  it('member remove_member', () => {
    const e = entry({ action: 'remove_member', entity_type: 'member', entity_name: 'Bob' });
    expect(getActionLabel(e, t)).toBe('removed "Bob"');
  });

  it('location create', () => {
    const e = entry({ action: 'create', entity_type: 'location', entity_name: 'Home' });
    expect(getActionLabel(e, t)).toBe('created location "Home"');
  });

  it('location regenerate_invite', () => {
    const e = entry({ action: 'regenerate_invite', entity_type: 'location' });
    expect(getActionLabel(e, t)).toBe('regenerated invite code');
  });

  it('fallback for unknown action/entity', () => {
    const e = entry({ action: 'someAction', entity_type: 'someType', entity_name: 'name' });
    expect(getActionLabel(e, t)).toBe('someAction someType "name"');
  });
});

describe('renderChangeDiff', () => {
  it('returns null for null changes', () => {
    expect(renderChangeDiff(entry({ changes: null }))).toBeNull();
  });

  it('returns item entries when only ITEM_FIELDS are present', () => {
    const e = entry({
      changes: {
        items_added: { old: null, new: ['A'] },
        items_removed: { old: ['B'], new: null },
      },
    });
    expect(renderChangeDiff(e)).toEqual([
      { field: '+ items', old: '', new: 'A' },
      { field: '− items', old: 'B', new: '' },
    ]);
  });

  it('returns null when only SKIP_FIELDS are present', () => {
    const e = entry({
      changes: {
        location: { old: 'A', new: 'B' },
        area_id: { old: 'x', new: 'y' },
      },
    });
    expect(renderChangeDiff(e)).toBeNull();
  });

  it('handles name change', () => {
    const e = entry({
      changes: { name: { old: 'A', new: 'B' } },
    });
    expect(renderChangeDiff(e)).toEqual([{ field: 'name', old: 'A', new: 'B' }]);
  });

  it('handles card_style JSON change', () => {
    const e = entry({
      changes: {
        card_style: {
          old: '{"variant":"default"}',
          new: '{"variant":"border"}',
        },
      },
    });
    expect(renderChangeDiff(e)).toEqual([{ field: 'style', old: 'default', new: 'border' }]);
  });

  it('handles card_style null to default', () => {
    const e = entry({
      changes: {
        card_style: { old: null, new: '{"variant":"border"}' },
      },
    });
    const result = renderChangeDiff(e);
    expect(result).toEqual([{ field: 'style', old: 'default', new: 'border' }]);
  });

  it('handles area field', () => {
    const e = entry({
      changes: { area: { old: 'Kitchen', new: 'Garage' } },
    });
    expect(renderChangeDiff(e)).toEqual([{ field: 'area', old: 'Kitchen', new: 'Garage' }]);
  });

  it('returns item additions as structured entries', () => {
    const e = entry({
      changes: {
        items_added: { old: null, new: ['Cable', 'Wire'] },
      },
    });
    expect(renderChangeDiff(e)).toEqual([
      { field: '+ items', old: '', new: 'Cable, Wire' },
    ]);
  });

  it('returns item removals as structured entries', () => {
    const e = entry({
      changes: {
        items_removed: { old: ['Cable'], new: null },
      },
    });
    expect(renderChangeDiff(e)).toEqual([
      { field: '− items', old: 'Cable', new: '' },
    ]);
  });

  it('returns item renames as structured entries', () => {
    const e = entry({
      changes: {
        items_renamed: { old: 'Old Name', new: 'New Name' },
      },
    });
    expect(renderChangeDiff(e)).toEqual([
      { field: 'renamed', old: 'Old Name', new: 'New Name' },
    ]);
  });

  it('returns both field changes and item changes', () => {
    const e = entry({
      changes: {
        name: { old: 'A', new: 'B' },
        items_added: { old: null, new: ['Cable'] },
      },
    });
    const result = renderChangeDiff(e);
    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({ field: 'name', old: 'A', new: 'B' });
    expect(result?.[1]).toEqual({ field: '+ items', old: '', new: 'Cable' });
  });
});

describe('getActionBadgeLabel', () => {
  it('capitalizes create', () => {
    expect(getActionBadgeLabel('create')).toBe('Created');
  });
  it('capitalizes update', () => {
    expect(getActionBadgeLabel('update')).toBe('Updated');
  });
  it('capitalizes delete', () => {
    expect(getActionBadgeLabel('delete')).toBe('Deleted');
  });
  it('returns Deleted for permanent_delete', () => {
    expect(getActionBadgeLabel('permanent_delete')).toBe('Deleted');
  });
  it('capitalizes restore', () => {
    expect(getActionBadgeLabel('restore')).toBe('Restored');
  });
  it('returns Photo for add_photo', () => {
    expect(getActionBadgeLabel('add_photo')).toBe('Photo');
  });
  it('returns Photo for delete_photo', () => {
    expect(getActionBadgeLabel('delete_photo')).toBe('Photo');
  });
  it('returns Moved for move_in', () => {
    expect(getActionBadgeLabel('move_in')).toBe('Moved');
  });
  it('returns Moved for move_out', () => {
    expect(getActionBadgeLabel('move_out')).toBe('Moved');
  });
  it('returns Joined for join', () => {
    expect(getActionBadgeLabel('join')).toBe('Joined');
  });
  it('returns Left for leave', () => {
    expect(getActionBadgeLabel('leave')).toBe('Left');
  });
  it('returns Removed for remove_member', () => {
    expect(getActionBadgeLabel('remove_member')).toBe('Removed');
  });
  it('returns Role for change_role', () => {
    expect(getActionBadgeLabel('change_role')).toBe('Role');
  });
  it('returns Invite for regenerate_invite', () => {
    expect(getActionBadgeLabel('regenerate_invite')).toBe('Invite');
  });
  it('capitalizes unknown action', () => {
    expect(getActionBadgeLabel('some_action')).toBe('Some action');
  });
});

describe('getChangedFieldLabels', () => {
  it('returns [] for non-update actions', () => {
    expect(getChangedFieldLabels(entry({ action: 'create' }), t)).toEqual([]);
    expect(getChangedFieldLabels(entry({ action: 'delete' }), t)).toEqual([]);
  });

  it('returns [] for update with no changes', () => {
    expect(getChangedFieldLabels(entry({ action: 'update', changes: null }), t)).toEqual([]);
  });

  it('labels scalar fields verbatim', () => {
    const e = entry({
      action: 'update',
      changes: {
        name: { old: 'a', new: 'b' },
        notes: { old: '', new: 'x' },
        tags: { old: [], new: ['y'] },
        icon: { old: 'i1', new: 'i2' },
        color: { old: 'red', new: 'blue' },
        visibility: { old: 'location', new: 'private' },
      },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['name', 'notes', 'tags', 'icon', 'color', 'visibility']);
  });

  it('labels card_style as "style"', () => {
    const e = entry({
      action: 'update',
      changes: { card_style: { old: '{}', new: '{"variant":"border"}' } },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['style']);
  });

  it('uses terminology for area', () => {
    const e = entry({
      action: 'update',
      changes: { area: { old: 'Kitchen', new: 'Garage' } },
    });
    const customTerminology = { ...t, area: 'zone' };
    expect(getChangedFieldLabels(e, customTerminology)).toEqual(['zone']);
  });

  it('labels items_added with plural count', () => {
    const e = entry({
      action: 'update',
      changes: { items_added: { old: null, new: ['a', 'b', 'c'] } },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['+3 items']);
  });

  it('labels items_added singular when count is 1', () => {
    const e = entry({
      action: 'update',
      changes: { items_added: { old: null, new: ['a'] } },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['+1 item']);
  });

  it('labels items_removed singular and plural', () => {
    const one = entry({
      action: 'update',
      changes: { items_removed: { old: ['a'], new: null } },
    });
    expect(getChangedFieldLabels(one, t)).toEqual(['\u22121 item']);

    const many = entry({
      action: 'update',
      changes: { items_removed: { old: ['a', 'b'], new: null } },
    });
    expect(getChangedFieldLabels(many, t)).toEqual(['\u22122 items']);
  });

  it('combines +N items and −M items into two chips', () => {
    const e = entry({
      action: 'update',
      changes: {
        items_added: { old: null, new: ['a', 'b'] },
        items_removed: { old: ['c'], new: null },
      },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['+2 items', '\u22121 item']);
  });

  it('labels legacy items_renamed object as "renamed item"', () => {
    const e = entry({
      action: 'update',
      changes: { items_renamed: { old: 'A', new: 'B' } },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['renamed item']);
  });

  it('labels array-form items_renamed with count', () => {
    const e = entry({
      action: 'update',
      changes: {
        items_renamed: {
          old: null,
          new: [
            { old: 'A', new: 'B' },
            { old: 'X', new: 'Y' },
          ],
        },
      },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['renamed 2 items']);
  });

  it('labels array-form items_renamed with singular when array has exactly one entry', () => {
    // Array form with length 1 occurs when cancelReverts filters a 2-entry array down to 1.
    const e = entry({
      action: 'update',
      changes: {
        items_renamed: {
          old: null,
          new: [{ old: 'A', new: 'B' }],
        },
      },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['renamed item']);
  });

  it('labels items_quantity as "quantity"', () => {
    const e = entry({
      action: 'update',
      changes: { items_quantity: { old: { name: 'x', qty: 1 }, new: { name: 'x', qty: 2 } } },
    });
    expect(getChangedFieldLabels(e, t)).toEqual(['quantity']);
  });
});
