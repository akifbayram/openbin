import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { CustomField } from '@/types';
import {
  ALL_FIELDS,
  FIELD_LABELS,
  type FieldKey,
  useColumnVisibility,
} from '../useColumnVisibility';

const KEY = STORAGE_KEYS.COLUMN_VISIBILITY;

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
describe('default state', () => {
  it('returns default visibility when localStorage is empty', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility).toEqual({
      icon: true,
      area: true,
      items: true,
      tags: true,
      updated: true,
      created: false,
      notes: false,
      createdBy: false,
      customFields: false,
    });
  });

  it('has default-true fields visible and default-false fields hidden', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.isVisible('icon')).toBe(true);
    expect(result.current.isVisible('area')).toBe(true);
    expect(result.current.isVisible('items')).toBe(true);
    expect(result.current.isVisible('tags')).toBe(true);
    expect(result.current.isVisible('updated')).toBe(true);
    expect(result.current.isVisible('created')).toBe(false);
    expect(result.current.isVisible('notes')).toBe(false);
    expect(result.current.isVisible('createdBy')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// localStorage hydration
// ---------------------------------------------------------------------------
describe('localStorage hydration', () => {
  it('reads persisted state from localStorage', () => {
    const stored: Record<FieldKey, boolean> = {
      icon: false, area: false, items: false, tags: false,
      updated: false, created: true, notes: true, createdBy: true, customFields: false,
    };
    localStorage.setItem(KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility).toEqual(stored);
  });

  it('merges partial stored data with defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ notes: true }));

    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility.notes).toBe(true);
    // Other fields retain defaults
    expect(result.current.visibility.icon).toBe(true);
    expect(result.current.visibility.created).toBe(false);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not valid json!!!');

    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility.icon).toBe(true);
    expect(result.current.visibility.created).toBe(false);
  });

  it('falls back to defaults on non-object JSON', () => {
    localStorage.setItem(KEY, '"just a string"');

    const { result } = renderHook(() => useColumnVisibility('table'));
    // Spread of a string over the defaults still yields defaults for known keys
    expect(result.current.visibility.icon).toBe(true);
    expect(result.current.visibility.created).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleField
// ---------------------------------------------------------------------------
describe('toggleField', () => {
  it('flips true to false', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility.icon).toBe(true);

    act(() => result.current.toggleField('icon'));
    expect(result.current.visibility.icon).toBe(false);
  });

  it('flips false to true', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.visibility.created).toBe(false);

    act(() => result.current.toggleField('created'));
    expect(result.current.visibility.created).toBe(true);
  });

  it('persists toggled state to localStorage', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));

    act(() => result.current.toggleField('notes'));

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.notes).toBe(true);
  });

  it('accumulates multiple toggles', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));

    act(() => {
      result.current.toggleField('icon');
      result.current.toggleField('created');
      result.current.toggleField('notes');
    });

    expect(result.current.visibility.icon).toBe(false);
    expect(result.current.visibility.created).toBe(true);
    expect(result.current.visibility.notes).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applicableFields per view mode
// ---------------------------------------------------------------------------
describe('applicableFields per view mode', () => {
  it('grid returns 6 fields', () => {
    const { result } = renderHook(() => useColumnVisibility('grid'));
    expect(result.current.applicableFields).toEqual(['icon', 'area', 'items', 'tags', 'notes', 'customFields']);
  });

  it('compact returns 2 fields', () => {
    const { result } = renderHook(() => useColumnVisibility('compact'));
    expect(result.current.applicableFields).toEqual(['icon', 'area']);
  });

  it('table returns 8 static fields (no customFields)', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.applicableFields).toEqual(['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy']);
    expect(result.current.applicableFields).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// isVisible respects applicability
// ---------------------------------------------------------------------------
describe('isVisible respects applicability', () => {
  it('returns false for non-applicable field even if toggled on', () => {
    // 'updated' is not applicable in grid mode
    const { result } = renderHook(() => useColumnVisibility('grid'));
    expect(result.current.visibility.updated).toBe(true); // on in state
    expect(result.current.isVisible('updated')).toBe(false); // not applicable
  });

  it('returns true for applicable + on field', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.isVisible('icon')).toBe(true);
  });

  it('returns false for applicable + off field', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.isVisible('created')).toBe(false);
  });

  it('returns false for non-applicable field in compact mode', () => {
    const { result } = renderHook(() => useColumnVisibility('compact'));
    // 'items' is not applicable in compact
    expect(result.current.isVisible('items')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dynamic custom field columns (table mode) — Slice 1
// ---------------------------------------------------------------------------
describe('dynamic custom field columns (table mode)', () => {
  // Deliberately out of position order to verify sorting
  const fields: CustomField[] = [
    { id: 'f2', location_id: 'loc1', name: 'Warranty', position: 1, created_at: '', updated_at: '' },
    { id: 'f1', location_id: 'loc1', name: 'Serial Number', position: 0, created_at: '', updated_at: '' },
  ];

  it('includes cf_<id> keys in applicableFields sorted by position', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));
    const cfKeys = result.current.applicableFields.filter((f: string) => f.startsWith('cf_'));
    expect(cfKeys).toEqual(['cf_f1', 'cf_f2']);
  });

  it('excludes static customFields from table applicableFields', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));
    expect(result.current.applicableFields).not.toContain('customFields');
  });

  it('static fields precede cf_ keys in applicableFields', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));
    const firstCfIdx = result.current.applicableFields.findIndex((f: string) => f.startsWith('cf_'));
    expect(firstCfIdx).toBeGreaterThan(0);
    const staticFields = result.current.applicableFields.slice(0, firstCfIdx);
    expect(staticFields.every((f: string) => !f.startsWith('cf_'))).toBe(true);
  });

  it('table mode without custom fields has no customFields or cf_ keys', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.applicableFields).not.toContain('customFields');
    expect(result.current.applicableFields.every((f: string) => !f.startsWith('cf_'))).toBe(true);
  });

  it('reacts to custom field list changes', () => {
    let cfInput = fields;
    const { result, rerender } = renderHook(() => useColumnVisibility('table', cfInput));
    expect(result.current.applicableFields).toContain('cf_f1');

    cfInput = [{ id: 'f3', location_id: 'loc1', name: 'Color', position: 0, created_at: '', updated_at: '' }];
    rerender();
    expect(result.current.applicableFields).toContain('cf_f3');
    expect(result.current.applicableFields).not.toContain('cf_f1');
  });
});

// ---------------------------------------------------------------------------
// cf_* visibility and persistence — Slice 2
// ---------------------------------------------------------------------------
describe('cf_* visibility and persistence', () => {
  const fields: CustomField[] = [
    { id: 'f1', location_id: 'loc1', name: 'Serial', position: 0, created_at: '', updated_at: '' },
  ];

  it('isVisible defaults to true for cf_* keys', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));
    expect(result.current.isVisible('cf_f1')).toBe(true);
  });

  it('toggleField toggles cf_* key off', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));
    expect(result.current.isVisible('cf_f1')).toBe(true);

    act(() => result.current.toggleField('cf_f1'));
    expect(result.current.isVisible('cf_f1')).toBe(false);
  });

  it('toggleField persists cf_* key to localStorage', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));

    act(() => result.current.toggleField('cf_f1'));

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.cf_f1).toBe(false);
  });

  it('reads persisted cf_* visibility from localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ cf_f1: false }));

    const { result } = renderHook(() => useColumnVisibility('table', fields));
    expect(result.current.isVisible('cf_f1')).toBe(false);
  });

  it('toggle back on after toggling off', () => {
    const { result } = renderHook(() => useColumnVisibility('table', fields));

    act(() => result.current.toggleField('cf_f1'));
    expect(result.current.isVisible('cf_f1')).toBe(false);

    act(() => result.current.toggleField('cf_f1'));
    expect(result.current.isVisible('cf_f1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Grid/compact isolation — Slice 2
// ---------------------------------------------------------------------------
describe('grid/compact isolation from custom fields param', () => {
  const fields: CustomField[] = [
    { id: 'f1', location_id: 'loc1', name: 'Serial', position: 0, created_at: '', updated_at: '' },
  ];

  it('grid applicableFields still includes customFields, ignores cf_ keys', () => {
    const { result } = renderHook(() => useColumnVisibility('grid', fields));
    expect(result.current.applicableFields).toContain('customFields');
    expect(result.current.applicableFields.every((f: string) => !f.startsWith('cf_'))).toBe(true);
  });

  it('compact applicableFields ignores custom fields param', () => {
    const { result } = renderHook(() => useColumnVisibility('compact', fields));
    expect(result.current.applicableFields).not.toContain('customFields');
    expect(result.current.applicableFields.every((f: string) => !f.startsWith('cf_'))).toBe(true);
  });

  it('grid isVisible for customFields respects stored visibility', () => {
    localStorage.setItem(KEY, JSON.stringify({ customFields: true }));
    const { result } = renderHook(() => useColumnVisibility('grid', fields));
    expect(result.current.isVisible('customFields')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
describe('exports', () => {
  it('ALL_FIELDS has 9 entries', () => {
    expect(ALL_FIELDS).toHaveLength(9);
  });

  it('FIELD_LABELS maps every field in ALL_FIELDS', () => {
    for (const field of ALL_FIELDS) {
      expect(FIELD_LABELS[field]).toBeDefined();
      expect(typeof FIELD_LABELS[field]).toBe('string');
      expect(FIELD_LABELS[field].length).toBeGreaterThan(0);
    }
  });
});
