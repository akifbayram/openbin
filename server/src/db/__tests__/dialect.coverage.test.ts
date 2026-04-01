import { afterAll, describe, expect, it } from 'vitest';
import { d, setDialect } from '../dialect.js';

describe('dialect helpers - daysFromNow (sqlite)', () => {
  afterAll(() => setDialect('sqlite'));

  it('daysFromNow(1)', () => {
    setDialect('sqlite');
    expect(d.daysFromNow(1)).toBe("datetime('now', '+1 days')");
  });

  it('daysFromNow(30)', () => {
    setDialect('sqlite');
    expect(d.daysFromNow(30)).toBe("datetime('now', '+30 days')");
  });
});

describe('dialect helpers - daysFromNow (postgres)', () => {
  afterAll(() => setDialect('sqlite'));

  it('daysFromNow(1)', () => {
    setDialect('postgres');
    expect(d.daysFromNow(1)).toBe("(NOW() + interval '1 days')::text");
  });

  it('daysFromNow(30)', () => {
    setDialect('postgres');
    expect(d.daysFromNow(30)).toBe("(NOW() + interval '30 days')::text");
  });
});

describe('dialect helpers - nullableEq (sqlite)', () => {
  afterAll(() => setDialect('sqlite'));

  it('nullableEq(col, param)', () => {
    setDialect('sqlite');
    expect(d.nullableEq('area_id', '$1')).toBe('area_id IS $1');
  });
});

describe('dialect helpers - nullableEq (postgres)', () => {
  afterAll(() => setDialect('sqlite'));

  it('nullableEq(col, param)', () => {
    setDialect('postgres');
    expect(d.nullableEq('area_id', '$1')).toBe('area_id IS NOT DISTINCT FROM $1');
  });
});
