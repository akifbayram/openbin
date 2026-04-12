import { beforeAll, describe, expect, it } from 'vitest';

import { setDialect } from '../../db/dialect.js';

beforeAll(() => {
  setDialect('sqlite');
});

const { buildBinListQuery } = await import('../binQueries.js');

describe('buildBinListQuery sort', () => {
  const base = { locationId: 'loc-1', userId: 'user-1' };

  it('defaults to updated_at DESC', () => {
    const q = buildBinListQuery({ ...base });
    expect(q.orderClause).toContain('b.updated_at');
    expect(q.orderClause).toContain('DESC');
  });

  it('supports name sort with COLLATE NOCASE', () => {
    const q = buildBinListQuery({ ...base, sort: 'name', sortDir: 'asc' });
    expect(q.orderClause).toContain('b.name');
    expect(q.orderClause).toContain('NOCASE');
    expect(q.orderClause).toContain('ASC');
  });

  it('supports last_used sort with NULLs last (DESC)', () => {
    const q = buildBinListQuery({ ...base, sort: 'last_used', sortDir: 'desc' });
    expect(q.orderClause).toContain('SELECT MAX(date) FROM bin_usage_days');
    expect(q.orderClause).toContain('IS NULL THEN 1 ELSE 0 END ASC');
    expect(q.orderClause).toContain('DESC');
  });

  it('last_used sort ASC still sorts NULLs last', () => {
    const q = buildBinListQuery({ ...base, sort: 'last_used', sortDir: 'asc' });
    expect(q.orderClause).toMatch(/IS NULL THEN 1 ELSE 0 END ASC/);
    expect(q.orderClause).toContain('ASC');
  });
});

describe('buildBinListQuery unusedSince filter', () => {
  const base = { locationId: 'loc-1', userId: 'user-1' };

  it('adds WHERE clause with MAX(date) comparison', () => {
    const q = buildBinListQuery({ ...base, unusedSince: '2026-01-12' });
    expect(q.whereSQL).toContain('SELECT MAX(date) FROM bin_usage_days');
    expect(q.params).toContain('2026-01-12');
  });

  it('includes bins with no usage rows via IS NULL branch', () => {
    const q = buildBinListQuery({ ...base, unusedSince: '2026-01-12' });
    expect(q.whereSQL).toContain('IS NULL OR');
  });

  it('ignores malformed date values', () => {
    const q = buildBinListQuery({ ...base, unusedSince: 'notadate' });
    expect(q.whereSQL).not.toContain('bin_usage_days');
    expect(q.params).not.toContain('notadate');
  });
});
