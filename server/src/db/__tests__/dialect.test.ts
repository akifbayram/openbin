import { afterAll, describe, expect, it } from 'vitest';
import { d, getDialect, setDialect } from '../dialect.js';

describe('dialect helpers - sqlite', () => {
  afterAll(() => {
    setDialect('sqlite');
  });

  it('defaults to sqlite', () => {
    setDialect('sqlite');
    expect(getDialect()).toBe('sqlite');
  });

  it('now()', () => {
    setDialect('sqlite');
    expect(d.now()).toBe("datetime('now')");
  });

  it('today()', () => {
    setDialect('sqlite');
    expect(d.today()).toBe("date('now')");
  });

  it('dateOf(col)', () => {
    setDialect('sqlite');
    expect(d.dateOf('created_at')).toBe('date(created_at)');
  });

  it('intervalSeconds(param)', () => {
    setDialect('sqlite');
    expect(d.intervalSeconds('$1')).toBe("datetime('now', '+' || $1 || ' seconds')");
  });

  it('intervalDaysAgo(daysExpr)', () => {
    setDialect('sqlite');
    expect(d.intervalDaysAgo('30')).toBe("datetime('now', '-' || 30 || ' days')");
  });

  it('fuzzyMatch(col, param)', () => {
    setDialect('sqlite');
    expect(d.fuzzyMatch('name', '?1')).toBe('fuzzy_match(name, ?1) = 1');
  });

  it('jsonEachFrom(col, alias)', () => {
    setDialect('sqlite');
    expect(d.jsonEachFrom('tags', 't')).toBe('json_each(tags) t');
  });

  it('jsonEach(col)', () => {
    setDialect('sqlite');
    expect(d.jsonEach('tags')).toBe('json_each(tags)');
  });

  it('jsonGroupArray(expr)', () => {
    setDialect('sqlite');
    expect(d.jsonGroupArray('name')).toBe('json_group_array(name)');
  });

  it('jsonGroupObject(key, value)', () => {
    setDialect('sqlite');
    expect(d.jsonGroupObject('id', 'value')).toBe('json_group_object(id, value)');
  });

  it('jsonObject(...pairs)', () => {
    setDialect('sqlite');
    expect(d.jsonObject("'id'", 'id', "'name'", 'name')).toBe(
      "json_object('id', id, 'name', name)",
    );
  });

  it('nocase()', () => {
    setDialect('sqlite');
    expect(d.nocase()).toBe('COLLATE NOCASE');
  });

  it('insertOrIgnore replaces INSERT with INSERT OR IGNORE', () => {
    setDialect('sqlite');
    expect(d.insertOrIgnore('INSERT INTO foo (a) VALUES (?)')).toBe(
      'INSERT OR IGNORE INTO foo (a) VALUES (?)',
    );
  });

  it('secondsAgo(n)', () => {
    setDialect('sqlite');
    expect(d.secondsAgo(30)).toBe("datetime('now', '-30 seconds')");
  });

  it('hoursAgo(n)', () => {
    setDialect('sqlite');
    expect(d.hoursAgo(2)).toBe("datetime('now', '-2 hours')");
  });

  it('daysAgo(n)', () => {
    setDialect('sqlite');
    expect(d.daysAgo(7)).toBe("datetime('now', '-7 days')");
  });
});

describe('dialect helpers - postgres', () => {
  afterAll(() => {
    setDialect('sqlite');
  });

  it('getDialect returns postgres after setDialect', () => {
    setDialect('postgres');
    expect(getDialect()).toBe('postgres');
  });

  it('now()', () => {
    setDialect('postgres');
    expect(d.now()).toBe('NOW()');
  });

  it('today()', () => {
    setDialect('postgres');
    expect(d.today()).toBe('CURRENT_DATE');
  });

  it('dateOf(col)', () => {
    setDialect('postgres');
    expect(d.dateOf('created_at')).toBe('created_at::date');
  });

  it('intervalSeconds(param)', () => {
    setDialect('postgres');
    expect(d.intervalSeconds('$1')).toBe('NOW() + make_interval(secs => $1::int)');
  });

  it('intervalDaysAgo(daysExpr)', () => {
    setDialect('postgres');
    expect(d.intervalDaysAgo('30')).toBe("NOW() - (30 || ' days')::interval");
  });

  it('fuzzyMatch(col, param)', () => {
    setDialect('postgres');
    expect(d.fuzzyMatch('name', '$1')).toBe('similarity(name, $1) > 0.3');
  });

  it('jsonEachFrom(col, alias)', () => {
    setDialect('postgres');
    expect(d.jsonEachFrom('tags', 't')).toBe(
      'LATERAL jsonb_array_elements_text(tags) AS t(value)',
    );
  });

  it('jsonEach(col)', () => {
    setDialect('postgres');
    expect(d.jsonEach('tags')).toBe('jsonb_array_elements_text(tags)');
  });

  it('jsonGroupArray(expr)', () => {
    setDialect('postgres');
    expect(d.jsonGroupArray('name')).toBe('json_agg(name)');
  });

  it('jsonGroupObject(key, value)', () => {
    setDialect('postgres');
    expect(d.jsonGroupObject('id', 'value')).toBe('json_object_agg(id, value)');
  });

  it('jsonObject(...pairs)', () => {
    setDialect('postgres');
    expect(d.jsonObject("'id'", 'id', "'name'", 'name')).toBe(
      "json_build_object('id', id, 'name', name)",
    );
  });

  it('nocase()', () => {
    setDialect('postgres');
    expect(d.nocase()).toBe('');
  });

  it('insertOrIgnore appends ON CONFLICT DO NOTHING', () => {
    setDialect('postgres');
    expect(d.insertOrIgnore('INSERT INTO foo (a) VALUES ($1)')).toBe(
      'INSERT INTO foo (a) VALUES ($1) ON CONFLICT DO NOTHING',
    );
  });

  it('secondsAgo(n)', () => {
    setDialect('postgres');
    expect(d.secondsAgo(30)).toBe("NOW() - interval '30 seconds'");
  });

  it('hoursAgo(n)', () => {
    setDialect('postgres');
    expect(d.hoursAgo(2)).toBe("NOW() - interval '2 hours'");
  });

  it('daysAgo(n)', () => {
    setDialect('postgres');
    expect(d.daysAgo(7)).toBe("NOW() - interval '7 days'");
  });
});
