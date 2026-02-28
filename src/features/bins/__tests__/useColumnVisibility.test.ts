import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import {
  useColumnVisibility,
  ALL_FIELDS,
  FIELD_LABELS,
  type FieldKey,
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
      updated: false, created: true, notes: true, createdBy: true,
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
  it('grid returns 5 fields', () => {
    const { result } = renderHook(() => useColumnVisibility('grid'));
    expect(result.current.applicableFields).toEqual(['icon', 'area', 'items', 'tags', 'notes']);
  });

  it('compact returns 2 fields', () => {
    const { result } = renderHook(() => useColumnVisibility('compact'));
    expect(result.current.applicableFields).toEqual(['icon', 'area']);
  });

  it('table returns all 8 fields', () => {
    const { result } = renderHook(() => useColumnVisibility('table'));
    expect(result.current.applicableFields).toEqual(ALL_FIELDS);
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
// Exports
// ---------------------------------------------------------------------------
describe('exports', () => {
  it('ALL_FIELDS has 8 entries', () => {
    expect(ALL_FIELDS).toHaveLength(8);
  });

  it('FIELD_LABELS maps every field in ALL_FIELDS', () => {
    for (const field of ALL_FIELDS) {
      expect(FIELD_LABELS[field]).toBeDefined();
      expect(typeof FIELD_LABELS[field]).toBe('string');
      expect(FIELD_LABELS[field].length).toBeGreaterThan(0);
    }
  });
});
