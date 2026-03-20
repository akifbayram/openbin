import { describe, expect, it } from 'vitest';
import { parseCSV } from '../csvParser.js';

describe('parseCSV', () => {
  it('parses basic rows', () => {
    expect(parseCSV('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCSV('"hello, world",b')).toEqual([['hello, world', 'b']]);
  });

  it('handles escaped quotes', () => {
    expect(parseCSV('"say ""hi""",b')).toEqual([['say "hi"', 'b']]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCSV('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('handles empty fields', () => {
    expect(parseCSV(',,')).toEqual([['', '', '']]);
  });

  it('handles single column', () => {
    expect(parseCSV('a\nb')).toEqual([['a'], ['b']]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('ignores trailing newline', () => {
    expect(parseCSV('a,b\n')).toEqual([['a', 'b']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCSV('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles mixed quoted and unquoted fields', () => {
    expect(parseCSV('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });
});
