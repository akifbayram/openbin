import { describe, expect, it } from 'vitest';
import { JSON_COLUMNS, deserializeRow, isUniqueViolation } from '../shared.js';

describe('JSON_COLUMNS', () => {
  it('contains exactly the expected columns', () => {
    expect(JSON_COLUMNS).toEqual(
      new Set(['items', 'tags', 'changes', 'settings', 'filters', 'custom_fields']),
    );
  });

  it('has 6 entries', () => {
    expect(JSON_COLUMNS.size).toBe(6);
  });
});

describe('isUniqueViolation', () => {
  it('returns true for PG code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns true for SQLite SQLITE_CONSTRAINT_UNIQUE', () => {
    expect(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(true);
  });

  it('returns false for PG foreign key violation 23503', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  it('throws on undefined error', () => {
    expect(() => isUniqueViolation(undefined)).toThrow();
  });

  it('throws on null error', () => {
    expect(() => isUniqueViolation(null)).toThrow();
  });

  it('returns false for error without code', () => {
    expect(isUniqueViolation({ message: 'some error' })).toBe(false);
  });

  it('matches constraint name via e.constraint', () => {
    expect(
      isUniqueViolation(
        { code: '23505', constraint: 'idx_users_email_unique' },
        'idx_users_email_unique',
      ),
    ).toBe(true);
  });

  it('matches constraint name via e.message.includes()', () => {
    expect(
      isUniqueViolation(
        { code: '23505', message: 'duplicate key violates idx_users_email_unique' },
        'idx_users_email_unique',
      ),
    ).toBe(true);
  });

  it('returns false when constraint name does not match', () => {
    expect(
      isUniqueViolation(
        { code: '23505', constraint: 'idx_other', message: 'duplicate key' },
        'idx_users_email_unique',
      ),
    ).toBe(false);
  });

  it('returns true for unique violation without constraint filter', () => {
    expect(isUniqueViolation({ code: '23505', constraint: 'idx_other' })).toBe(true);
  });

  it('handles missing message gracefully when checking constraint', () => {
    expect(
      isUniqueViolation({ code: '23505' }, 'idx_users_email_unique'),
    ).toBe(false);
  });
});

describe('deserializeRow', () => {
  it('parses string JSON in JSON_COLUMNS keys', () => {
    const row = { items: '["a","b"]', name: 'test' };
    const result = deserializeRow<{ items: string[]; name: string }>(row);
    expect(result.items).toEqual(['a', 'b']);
    expect(result.name).toBe('test');
  });

  it('skips non-string values (PG JSONB returns objects directly)', () => {
    const row = { tags: ['already', 'parsed'], name: 'test' };
    const result = deserializeRow<{ tags: string[]; name: string }>(row);
    expect(result.tags).toEqual(['already', 'parsed']);
  });

  it('skips null values in JSON columns', () => {
    const row = { items: null, name: 'test' };
    const result = deserializeRow<{ items: null; name: string }>(row);
    expect(result.items).toBeNull();
  });

  it('skips number values in JSON columns', () => {
    const row = { settings: 42 };
    const result = deserializeRow<{ settings: number }>(row);
    expect(result.settings).toBe(42);
  });

  it('ignores non-JSON_COLUMNS keys even if they contain JSON strings', () => {
    const row = { name: '{"foo":"bar"}' };
    const result = deserializeRow<{ name: string }>(row);
    expect(result.name).toBe('{"foo":"bar"}');
  });

  it('catches malformed JSON and leaves value as string', () => {
    const row = { items: '{not valid json' };
    const result = deserializeRow<{ items: string }>(row);
    expect(result.items).toBe('{not valid json');
  });

  it('handles empty object', () => {
    const result = deserializeRow<Record<string, never>>({});
    expect(result).toEqual({});
  });

  it('parses all JSON_COLUMNS when present as strings', () => {
    const row = {
      items: '[]',
      tags: '["a"]',
      changes: '{}',
      settings: '{"k":"v"}',
      filters: '[]',
      custom_fields: '{"f":"1"}',
    };
    const result = deserializeRow<Record<string, unknown>>(row);
    expect(result.items).toEqual([]);
    expect(result.tags).toEqual(['a']);
    expect(result.changes).toEqual({});
    expect(result.settings).toEqual({ k: 'v' });
    expect(result.filters).toEqual([]);
    expect(result.custom_fields).toEqual({ f: '1' });
  });

  it('does not mutate the original row', () => {
    const row = { items: '["a"]' };
    deserializeRow(row);
    expect(row.items).toBe('["a"]');
  });
});
